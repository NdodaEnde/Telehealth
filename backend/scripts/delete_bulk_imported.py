"""
Script to delete ALL bulk-imported Campus Africa users from the database.
This removes auth users, profiles, and user_roles for a fresh re-import.

Usage:
    python delete_bulk_imported.py --dry-run    # Preview what will be deleted
    python delete_bulk_imported.py --execute    # Actually delete
"""
import asyncio
import httpx
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY


async def get_bulk_imported_users():
    """Get all users that were bulk imported from Campus Africa"""
    bulk_users = []
    page = 1
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                params={'page': page, 'per_page': 100},
                headers={
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
                }
            )
            
            if response.status_code != 200:
                print(f"Error fetching users: {response.status_code}")
                break
            
            data = response.json()
            batch = data.get('users', [])
            
            if not batch:
                break
            
            for user in batch:
                metadata = user.get('user_metadata', {})
                if metadata.get('imported_from') == 'campus_africa_bulk':
                    bulk_users.append({
                        'id': user['id'],
                        'email': user.get('email', 'N/A'),
                        'first_name': metadata.get('first_name', ''),
                        'last_name': metadata.get('last_name', '')
                    })
            
            print(f"Scanned {page * 100} users, found {len(bulk_users)} bulk-imported...")
            
            if len(batch) < 100:
                break
            page += 1
    
    return bulk_users


async def delete_user_role(user_id: str):
    """Delete user role from user_roles table"""
    url = f"{SUPABASE_URL}/rest/v1/user_roles?user_id=eq.{user_id}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(
            url,
            headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
            }
        )
        return response.status_code in [200, 204]


async def delete_profile(user_id: str):
    """Delete profile from profiles table"""
    url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(
            url,
            headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
            }
        )
        return response.status_code in [200, 204]


async def delete_auth_user(user_id: str):
    """Delete user from Supabase Auth"""
    url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(
            url,
            headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
            }
        )
        return response.status_code in [200, 204]


async def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ['--dry-run', '--execute']:
        print(__doc__)
        print("\nPlease specify --dry-run or --execute")
        sys.exit(1)
    
    dry_run = sys.argv[1] == '--dry-run'
    
    print("=" * 60)
    print("DELETE BULK-IMPORTED CAMPUS AFRICA USERS")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'EXECUTE (will delete users)'}")
    print()
    
    # Get all bulk-imported users
    print("Finding bulk-imported users...")
    bulk_users = await get_bulk_imported_users()
    
    print(f"\nFound {len(bulk_users)} bulk-imported Campus Africa users")
    
    if not bulk_users:
        print("No bulk-imported users to delete.")
        return
    
    # Show sample
    print("\nSample of users to delete:")
    print("-" * 60)
    for user in bulk_users[:10]:
        print(f"  {user['email']:<40} ({user['first_name']} {user['last_name']})")
    if len(bulk_users) > 10:
        print(f"  ... and {len(bulk_users) - 10} more")
    print("-" * 60)
    
    if dry_run:
        print(f"\n[DRY RUN] Would delete {len(bulk_users)} users.")
        print("Run with --execute to delete these users.")
        return
    
    # Confirm
    print(f"\n⚠️  WARNING: This will permanently delete {len(bulk_users)} users!")
    print("This includes their auth accounts, profiles, and roles.")
    confirm = input("Type 'DELETE ALL' to confirm: ")
    
    if confirm != 'DELETE ALL':
        print("Aborted.")
        return
    
    # Execute deletion
    print("\nDeleting users...")
    deleted = 0
    failed = 0
    
    for i, user in enumerate(bulk_users, 1):
        user_id = user['id']
        
        # Delete in order: user_roles -> profiles -> auth (due to foreign keys)
        await delete_user_role(user_id)
        await delete_profile(user_id)
        success = await delete_auth_user(user_id)
        
        if success:
            deleted += 1
        else:
            failed += 1
            print(f"  Failed to delete: {user['email']}")
        
        if deleted % 50 == 0:
            print(f"  Deleted {deleted}/{len(bulk_users)}...")
    
    print("\n" + "=" * 60)
    print("DELETION COMPLETE")
    print(f"  - Deleted: {deleted}")
    print(f"  - Failed: {failed}")
    print("=" * 60)
    print("\nYou can now re-import the Campus Africa list with all columns.")


if __name__ == '__main__':
    asyncio.run(main())
