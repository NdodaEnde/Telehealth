"""
Cleanup script to delete Supabase auth users that don't have corresponding profiles.
These are orphaned users created during failed bulk imports.

Usage:
    python cleanup_orphan_users.py --dry-run    # Preview what will be deleted
    python cleanup_orphan_users.py --execute    # Actually delete the users
"""
import asyncio
import httpx
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

async def get_all_auth_users():
    """Get all users from Supabase Auth"""
    users = []
    page = 1
    per_page = 100
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                params={'page': page, 'per_page': per_page},
                headers={
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
                }
            )
            
            if response.status_code != 200:
                print(f"Error fetching users: {response.status_code} - {response.text}")
                break
            
            data = response.json()
            batch = data.get('users', [])
            
            if not batch:
                break
                
            users.extend(batch)
            print(f"Fetched {len(users)} auth users so far...")
            
            if len(batch) < per_page:
                break
            
            page += 1
    
    return users


async def get_all_profiles():
    """Get all profile IDs from profiles table"""
    profiles = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={'select': 'id'},
            headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
            }
        )
        
        if response.status_code == 200:
            profiles = response.json()
        else:
            print(f"Error fetching profiles: {response.status_code} - {response.text}")
    
    return {p['id'] for p in profiles}


async def delete_auth_user(user_id: str, email: str):
    """Delete a user from Supabase Auth"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
            }
        )
        
        if response.status_code in [200, 204]:
            return True, None
        else:
            return False, f"{response.status_code} - {response.text}"


async def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ['--dry-run', '--execute']:
        print(__doc__)
        print("\nPlease specify --dry-run or --execute")
        sys.exit(1)
    
    dry_run = sys.argv[1] == '--dry-run'
    
    print("=" * 60)
    print("ORPHAN USER CLEANUP SCRIPT")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'EXECUTE (will delete users)'}")
    print()
    
    # Get all auth users
    print("Fetching all auth users...")
    auth_users = await get_all_auth_users()
    print(f"Found {len(auth_users)} total auth users")
    
    # Get all profiles
    print("\nFetching all profiles...")
    profile_ids = await get_all_profiles()
    print(f"Found {len(profile_ids)} profiles")
    
    # Find orphaned users (auth users without profiles)
    orphaned_users = []
    for user in auth_users:
        user_id = user.get('id')
        email = user.get('email', 'N/A')
        
        if user_id not in profile_ids:
            # Check if this was from bulk import
            metadata = user.get('user_metadata', {})
            imported_from = metadata.get('imported_from', '')
            
            orphaned_users.append({
                'id': user_id,
                'email': email,
                'created_at': user.get('created_at', 'N/A'),
                'imported_from': imported_from
            })
    
    print(f"\nFound {len(orphaned_users)} orphaned auth users (no profile)")
    
    if not orphaned_users:
        print("\nNo cleanup needed!")
        return
    
    # Show preview
    print("\n" + "-" * 60)
    print("ORPHANED USERS TO DELETE:")
    print("-" * 60)
    
    bulk_import_count = 0
    other_count = 0
    
    for i, user in enumerate(orphaned_users[:50], 1):  # Show first 50
        source = "BULK IMPORT" if user['imported_from'] == 'campus_africa_bulk' else "OTHER"
        if user['imported_from'] == 'campus_africa_bulk':
            bulk_import_count += 1
        else:
            other_count += 1
        print(f"{i:4}. {user['email']:<40} [{source}]")
    
    if len(orphaned_users) > 50:
        print(f"... and {len(orphaned_users) - 50} more")
    
    print("\n" + "-" * 60)
    print(f"SUMMARY:")
    print(f"  - From bulk import: {bulk_import_count}")
    print(f"  - Other sources: {other_count}")
    print(f"  - Total to delete: {len(orphaned_users)}")
    print("-" * 60)
    
    if dry_run:
        print("\n[DRY RUN] No users were deleted.")
        print("Run with --execute to delete these users.")
        return
    
    # Confirm before executing
    print("\n⚠️  WARNING: This will permanently delete these users!")
    confirm = input("Type 'DELETE' to confirm: ")
    
    if confirm != 'DELETE':
        print("Aborted.")
        return
    
    # Execute deletion
    print("\nDeleting orphaned users...")
    deleted = 0
    failed = 0
    
    for i, user in enumerate(orphaned_users, 1):
        success, error = await delete_auth_user(user['id'], user['email'])
        
        if success:
            deleted += 1
            if deleted % 50 == 0:
                print(f"  Deleted {deleted}/{len(orphaned_users)}...")
        else:
            failed += 1
            print(f"  Failed to delete {user['email']}: {error}")
    
    print("\n" + "=" * 60)
    print(f"CLEANUP COMPLETE")
    print(f"  - Deleted: {deleted}")
    print(f"  - Failed: {failed}")
    print("=" * 60)


if __name__ == '__main__':
    asyncio.run(main())
