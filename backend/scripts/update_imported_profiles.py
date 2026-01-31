"""
Script to update profiles of bulk-imported users with their data from the Excel file.
Run this AFTER fixing the bulk import code to update users who were imported
but didn't get their profile data saved.

Usage:
    python update_imported_profiles.py --file /path/to/excel.xlsx --password yourpassword
    python update_imported_profiles.py --file /path/to/excel.xlsx  # If not password protected
"""
import asyncio
import httpx
import sys
import os
import io
import re
from datetime import datetime

# Excel handling
import openpyxl
import msoffcrypto

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY


def normalize_phone(phone: str) -> str:
    """Normalize South African phone number"""
    if not phone:
        return ""
    phone = re.sub(r'[^\d+]', '', str(phone))
    if phone.startswith('0') and len(phone) == 10:
        phone = '+27' + phone[1:]
    return phone


def parse_date(date_value) -> str:
    """Parse date from various formats"""
    if not date_value:
        return None
    
    if isinstance(date_value, datetime):
        return date_value.strftime("%Y-%m-%d")
    
    date_str = str(date_value).strip()
    
    formats = [
        "%Y/%m/%d", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y",
        "%Y/%m/%d %H:%M:%S", "%d/%m/%Y %H:%M:%S"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    return None


def validate_sa_id(id_number: str) -> dict:
    """Validate South African ID and extract DOB/gender"""
    if not id_number or len(id_number) != 13 or not id_number.isdigit():
        return {"valid": False}
    
    try:
        yy = int(id_number[0:2])
        mm = int(id_number[2:4])
        dd = int(id_number[4:6])
        year = 2000 + yy if yy <= 25 else 1900 + yy
        dob = datetime(year, mm, dd)
        gender_digit = int(id_number[6:10])
        gender = "male" if gender_digit >= 5000 else "female"
        return {"valid": True, "date_of_birth": dob.strftime("%Y-%m-%d"), "gender": gender}
    except:
        return {"valid": False}


async def get_auth_users_by_email():
    """Get all auth users mapped by email"""
    users_by_email = {}
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
                break
            
            data = response.json()
            batch = data.get('users', [])
            
            if not batch:
                break
            
            for user in batch:
                email = user.get('email', '').lower()
                if email:
                    users_by_email[email] = user
            
            print(f"Fetched {len(users_by_email)} auth users...")
            
            if len(batch) < 100:
                break
            page += 1
    
    return users_by_email


async def update_profile(user_id: str, data: dict):
    """Update a profile in Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.patch(
            url,
            json=data,
            headers={
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        )
        return response.status_code == 200


async def main():
    import argparse
    parser = argparse.ArgumentParser(description='Update profiles for bulk-imported users')
    parser.add_argument('--file', required=True, help='Path to Excel file')
    parser.add_argument('--password', default=None, help='Excel file password if protected')
    args = parser.parse_args()
    
    print("=" * 60)
    print("UPDATE IMPORTED PROFILES")
    print("=" * 60)
    
    # Open Excel file
    print(f"\nOpening Excel file: {args.file}")
    with open(args.file, 'rb') as f:
        file_stream = io.BytesIO(f.read())
    
    if args.password:
        decrypted = io.BytesIO()
        ms_file = msoffcrypto.OfficeFile(file_stream)
        if ms_file.is_encrypted():
            ms_file.load_key(password=args.password)
            ms_file.decrypt(decrypted)
            decrypted.seek(0)
            workbook = openpyxl.load_workbook(decrypted, data_only=True)
        else:
            file_stream.seek(0)
            workbook = openpyxl.load_workbook(file_stream, data_only=True)
    else:
        workbook = openpyxl.load_workbook(file_stream, data_only=True)
    
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    
    # Parse headers
    headers = [str(h).strip().lower() if h else f"col_{i}" for i, h in enumerate(rows[0])]
    
    column_map = {
        'first name': 'first_name', 'firstname': 'first_name',
        'last name': 'last_name', 'lastname': 'last_name', 'surname': 'last_name',
        'i.d number': 'id_number', 'id number': 'id_number', 'id_number': 'id_number',
        'dob': 'date_of_birth', 'date of birth': 'date_of_birth',
        'gender': 'gender', 'sex': 'gender',
        'cell': 'phone', 'phone': 'phone', 'mobile': 'phone',
        'email': 'email', 'e-mail': 'email',
    }
    
    mapped_headers = [column_map.get(h, h) for h in headers]
    
    print(f"Found {len(rows) - 1} data rows")
    
    # Get auth users
    print("\nFetching auth users from Supabase...")
    auth_users = await get_auth_users_by_email()
    print(f"Found {len(auth_users)} auth users")
    
    # Process rows
    updated = 0
    skipped = 0
    not_found = 0
    
    for row in rows[1:]:
        row_data = dict(zip(mapped_headers, row))
        
        email = str(row_data.get('email', '')).strip().lower() if row_data.get('email') else ''
        
        if not email:
            skipped += 1
            continue
        
        # Check if user exists in auth
        auth_user = auth_users.get(email)
        if not auth_user:
            not_found += 1
            continue
        
        user_id = auth_user['id']
        
        # Prepare profile data
        first_name = str(row_data.get('first_name', '')).strip() if row_data.get('first_name') else ''
        last_name = str(row_data.get('last_name', '')).strip() if row_data.get('last_name') else ''
        id_number = str(row_data.get('id_number', '')).strip() if row_data.get('id_number') else ''
        phone = normalize_phone(str(row_data.get('phone', ''))) if row_data.get('phone') else ''
        
        # Parse DOB and gender from ID if available
        dob = None
        gender = str(row_data.get('gender', '')).lower() if row_data.get('gender') else None
        
        if id_number:
            id_validation = validate_sa_id(id_number)
            if id_validation['valid']:
                dob = id_validation['date_of_birth']
                gender = id_validation['gender']
        
        if not dob:
            dob = parse_date(row_data.get('date_of_birth'))
        
        profile_data = {
            'first_name': first_name,
            'last_name': last_name,
            'phone': phone,
            'id_number': id_number,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        if dob:
            profile_data['date_of_birth'] = dob
        
        # Update profile
        success = await update_profile(user_id, profile_data)
        
        if success:
            updated += 1
            if updated % 100 == 0:
                print(f"  Updated {updated} profiles...")
        else:
            skipped += 1
    
    workbook.close()
    
    print("\n" + "=" * 60)
    print("UPDATE COMPLETE")
    print(f"  - Updated: {updated}")
    print(f"  - Skipped: {skipped}")
    print(f"  - Not found in auth: {not_found}")
    print("=" * 60)


if __name__ == '__main__':
    asyncio.run(main())
