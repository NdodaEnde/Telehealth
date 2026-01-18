#!/usr/bin/env python3
"""
Backend API Testing for HCF Telehealth Application
Tests the following APIs:
1. Health Check API - GET /api/health (no auth)
2. Password Reset APIs - POST /api/auth/password/reset-request, GET /api/auth/verify-token (no auth)
3. Protected APIs - Should return 401 without auth token
4. API Documentation - GET /api/docs
5. Prescription PDF Generation API - POST /api/prescriptions/generate-pdf
6. Analytics Dashboard API - GET /api/analytics/dashboard
7. Analytics Overview API - GET /api/analytics/overview
"""

import requests
import json
import base64
import sys
from datetime import datetime
import os

# Get backend URL from environment
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://code-advisor-6.preview.emergentagent.com')
BASE_URL = f"{BACKEND_URL}/api"

def test_health_check():
    """Test the health check endpoint"""
    print("\n=== Testing Health Check API ===")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Validate response structure
            required_fields = ['status', 'timestamp', 'services']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"❌ FAILED: Missing required fields: {missing_fields}")
                return False
            
            if data.get('status') != 'healthy':
                print(f"❌ FAILED: Expected status 'healthy', got '{data.get('status')}'")
                return False
            
            services = data.get('services', {})
            if not isinstance(services, dict):
                print(f"❌ FAILED: Services should be a dictionary")
                return False
            
            print("✅ PASSED: Health check API working correctly")
            return True
        else:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return False

def test_password_reset_request():
    """Test the password reset request endpoint (no auth required)"""
    print("\n=== Testing Password Reset Request API ===")
    
    test_data = {
        "email": "test@example.com"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/password/reset-request",
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Validate response structure
            if 'success' not in data:
                print("❌ FAILED: Missing 'success' field in response")
                return False
            
            if not data.get('success'):
                print(f"❌ FAILED: Password reset request failed")
                return False
            
            if 'message' not in data:
                print("❌ FAILED: Missing 'message' field in response")
                return False
            
            # Should return success message (doesn't reveal if email exists)
            message = data.get('message', '')
            if 'password reset link' not in message.lower():
                print(f"❌ FAILED: Unexpected message format: {message}")
                return False
            
            print("✅ PASSED: Password reset request API working correctly")
            return True
        else:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return False


def test_verify_token():
    """Test the token verification endpoint (no auth required)"""
    print("\n=== Testing Token Verification API ===")
    
    try:
        # Test with invalid token
        response = requests.get(
            f"{BASE_URL}/auth/verify-token?token=invalid-token",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Should return valid: false for invalid token
            if 'data' in data and isinstance(data['data'], dict):
                valid = data['data'].get('valid')
                if valid is False:
                    print("✅ PASSED: Token verification API correctly identifies invalid token")
                    return True
                else:
                    print(f"❌ FAILED: Expected valid=false, got valid={valid}")
                    return False
            else:
                print("❌ FAILED: Missing or invalid 'data' field in response")
                return False
        else:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return False


def test_protected_endpoints_without_auth():
    """Test that protected endpoints return 401 without authentication"""
    print("\n=== Testing Protected Endpoints (No Auth) ===")
    
    protected_endpoints = [
        ("GET", "/users/me", "User Profile"),
        ("GET", "/appointments", "Appointments List"),
        ("GET", "/prescriptions", "Prescriptions List"),
        ("GET", "/clinical-notes", "Clinical Notes List"),
        ("GET", "/users/clinicians", "Clinicians List")
    ]
    
    all_passed = True
    
    for method, endpoint, name in protected_endpoints:
        try:
            print(f"\nTesting {name}: {method} {endpoint}")
            
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            else:
                response = requests.request(method, f"{BASE_URL}{endpoint}", timeout=10)
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 401:
                print(f"✅ PASSED: {name} correctly returns 401 without auth")
            else:
                print(f"❌ FAILED: {name} expected 401, got {response.status_code}")
                print(f"Response: {response.text[:200]}...")
                all_passed = False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ FAILED: {name} request error - {str(e)}")
            all_passed = False
        except Exception as e:
            print(f"❌ FAILED: {name} unexpected error - {str(e)}")
            all_passed = False
    
    if all_passed:
        print("\n✅ PASSED: All protected endpoints correctly require authentication")
    else:
        print("\n❌ FAILED: Some protected endpoints do not require authentication")
    
    return all_passed


def test_api_documentation():
    """Test that API documentation is accessible"""
    print("\n=== Testing API Documentation ===")
    
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            content = response.text
            
            # Check if it's HTML content (Swagger UI)
            if 'text/html' in content_type or '<html' in content.lower():
                print("✅ PASSED: API documentation is accessible")
                print(f"Content-Type: {content_type}")
                return True
            else:
                print(f"❌ FAILED: Unexpected content type: {content_type}")
                return False
        else:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text[:200]}...")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return False
    except Exception as e:

def test_prescription_pdf_generation():
    """Test the prescription PDF generation endpoint"""
    print("\n=== Testing Prescription PDF Generation API ===")
    
    # Sample prescription data as specified in the review request
    test_data = {
        "prescription_id": "test-123",
        "patient_name": "John Doe",
        "clinician_name": "Smith",
        "medication_name": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "3 times daily",
        "duration": "7 days",
        "quantity": 21,
        "refills": 0,
        "instructions": "Take with food",
        "prescribed_at": "2025-01-18T10:00:00Z"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/prescriptions/generate-pdf",
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ PASSED: Prescription PDF generation correctly requires authentication")
            return True
        elif response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Validate response structure
            if 'success' not in data:
                print("❌ FAILED: Missing 'success' field in response")
                return False
            
            if not data.get('success'):
                error_msg = data.get('error', 'Unknown error')
                print(f"❌ FAILED: PDF generation failed - {error_msg}")
                return False
            
            if 'pdf_base64' not in data:
                print("❌ FAILED: Missing 'pdf_base64' field in response")
                return False
            
            pdf_data = data.get('pdf_base64')
            if not pdf_data:
                print("❌ FAILED: Empty PDF data")
                return False
            
            # Validate base64 encoding
            try:
                decoded = base64.b64decode(pdf_data)
                if not decoded.startswith(b'%PDF'):
                    print("❌ FAILED: Invalid PDF format")
                    return False
                print(f"✅ PDF generated successfully, size: {len(decoded)} bytes")
            except Exception as e:
                print(f"❌ FAILED: Invalid base64 encoding - {str(e)}")
                return False
            
            print("✅ PASSED: Prescription PDF generation working correctly")
            return True
        else:
            print(f"❌ FAILED: Expected status 200 or 401, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return False
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return False
    """Test the prescription PDF generation endpoint"""
    print("\n=== Testing Prescription PDF Generation API ===")
    
    # Sample prescription data as specified in the review request
    test_data = {
        "prescription_id": "test-123",
        "patient_name": "John Doe",
        "clinician_name": "Smith",
        "medication_name": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "3 times daily",
        "duration": "7 days",
        "quantity": 21,
        "refills": 0,
        "instructions": "Take with food",
        "prescribed_at": "2025-01-18T10:00:00Z"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/prescriptions/generate-pdf",
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Validate response structure
            if 'success' not in data:
                print("❌ FAILED: Missing 'success' field in response")
                return False
            
            if not data.get('success'):
                error_msg = data.get('error', 'Unknown error')
                print(f"❌ FAILED: PDF generation failed - {error_msg}")
                return False
            
            if 'pdf_base64' not in data:
                print("❌ FAILED: Missing 'pdf_base64' field in response")
                return False
            
            pdf_data = data.get('pdf_base64')
            if not pdf_data:
                print("❌ FAILED: Empty PDF data")
                return False
            
            # Validate base64 encoding
            try:
                decoded = base64.b64decode(pdf_data)
                if not decoded.startswith(b'%PDF'):
                    print("❌ FAILED: Invalid PDF format")
                    return False
                print(f"✅ PDF generated successfully, size: {len(decoded)} bytes")
            except Exception as e:
                print(f"❌ FAILED: Invalid base64 encoding - {str(e)}")
                return False
            
            print("✅ PASSED: Prescription PDF generation working correctly")
            return True
        else:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return False

def test_analytics_dashboard():
    """Test the analytics dashboard endpoint"""
    print("\n=== Testing Analytics Dashboard API ===")
    
    try:
        # Test with default parameters
        response = requests.get(f"{BASE_URL}/analytics/dashboard?days=30", timeout=15)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ PASSED: Analytics dashboard correctly requires authentication")
            return True
        elif response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Validate response structure
            required_fields = ['overview', 'appointment_trends', 'consultation_types', 'status_distribution']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"❌ FAILED: Missing required fields: {missing_fields}")
                return False
            
            # Validate overview structure
            overview = data.get('overview', {})
            overview_fields = ['total_users', 'total_patients', 'total_clinicians', 'total_appointments']
            for field in overview_fields:
                if field not in overview:
                    print(f"❌ FAILED: Missing overview field: {field}")
                    return False
                if not isinstance(overview[field], (int, float)):
                    print(f"❌ FAILED: Overview field {field} should be numeric")
                    return False
            
            # Validate consultation_types structure
            consultation_types = data.get('consultation_types', {})
            if not isinstance(consultation_types, dict):
                print("❌ FAILED: consultation_types should be a dictionary")
                return False
            
            # Validate appointment_trends is a list
            appointment_trends = data.get('appointment_trends', [])
            if not isinstance(appointment_trends, list):
                print("❌ FAILED: appointment_trends should be a list")
                return False
            
            print("✅ PASSED: Analytics dashboard API working correctly")
            print(f"   - Total users: {overview.get('total_users', 0)}")
            print(f"   - Total appointments: {overview.get('total_appointments', 0)}")
            print(f"   - Appointment trends count: {len(appointment_trends)}")
            return True
        else:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return False

def test_analytics_overview():
    """Test the analytics overview endpoint"""
    print("\n=== Testing Analytics Overview API ===")
    
    try:
        response = requests.get(f"{BASE_URL}/analytics/overview", timeout=15)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ PASSED: Analytics overview correctly requires authentication")
            return True
        elif response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Validate response structure
            required_fields = [
                'total_users', 'total_patients', 'total_clinicians', 
                'total_appointments', 'total_consultations', 'total_prescriptions',
                'appointments_today', 'appointments_this_week', 'appointments_this_month',
                'completion_rate', 'average_consultation_duration'
            ]
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ FAILED: Missing required fields: {missing_fields}")
                return False
            
            # Validate all fields are numeric
            for field in required_fields:
                value = data.get(field)
                if not isinstance(value, (int, float)):
                    print(f"❌ FAILED: Field {field} should be numeric, got {type(value)}")
                    return False
            
            print("✅ PASSED: Analytics overview API working correctly")
            print(f"   - Total users: {data.get('total_users')}")
            print(f"   - Total patients: {data.get('total_patients')}")
            print(f"   - Total clinicians: {data.get('total_clinicians')}")
            print(f"   - Total appointments: {data.get('total_appointments')}")
            print(f"   - Completion rate: {data.get('completion_rate')}%")
            return True
        else:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return False

def main():
    """Run all backend API tests"""
    print("🚀 Starting HCF Telehealth Backend API Tests")
    print(f"Backend URL: {BASE_URL}")
    print("=" * 60)
    
    # Track test results
    test_results = {}
    
    # Run all tests
    test_results['health_check'] = test_health_check()
    test_results['password_reset_request'] = test_password_reset_request()
    test_results['verify_token'] = test_verify_token()
    test_results['protected_endpoints'] = test_protected_endpoints_without_auth()
    test_results['api_documentation'] = test_api_documentation()
    test_results['prescription_pdf'] = test_prescription_pdf_generation()
    test_results['analytics_dashboard'] = test_analytics_dashboard()
    test_results['analytics_overview'] = test_analytics_overview()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend API tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the details above.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)