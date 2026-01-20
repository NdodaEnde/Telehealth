import httpx
from typing import Optional, Dict, Any, List
from config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
import logging

logger = logging.getLogger(__name__)

class SupabaseClient:
    """Supabase REST API client for backend operations"""
    
    def __init__(self, use_service_key: bool = True):
        self.base_url = SUPABASE_URL
        self.rest_url = f"{SUPABASE_URL}/rest/v1"
        self.auth_url = f"{SUPABASE_URL}/auth/v1"
        # Use service key for backend operations (bypasses RLS)
        self.api_key = SUPABASE_SERVICE_KEY if use_service_key and SUPABASE_SERVICE_KEY else SUPABASE_ANON_KEY
        
    def _get_headers(self, access_token: Optional[str] = None) -> Dict[str, str]:
        headers = {
            'apikey': self.api_key,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        if access_token:
            headers['Authorization'] = f'Bearer {access_token}'
        else:
            headers['Authorization'] = f'Bearer {self.api_key}'
        return headers
    
    async def select(
        self, 
        table: str, 
        columns: str = '*',
        filters: Optional[Dict[str, Any]] = None,
        order: Optional[str] = None,
        limit: Optional[int] = None,
        access_token: Optional[str] = None
    ) -> List[Dict]:
        """Select records from a table
        
        Filters support:
        - Simple equality: {"field": "value"}
        - Operators as dict: {"field": {"neq": "value"}} -> field=neq.value
        - Null check: {"field": {"is": "null"}} -> field=is.null
        - List (IN): {"field": ["val1", "val2"]}
        """
        url = f"{self.rest_url}/{table}?select={columns}"
        
        if filters:
            for key, value in filters.items():
                if isinstance(value, list):
                    url += f"&{key}=in.({','.join(map(str, value))})"
                elif isinstance(value, dict):
                    for op, val in value.items():
                        url += f"&{key}={op}.{val}"
                elif value is None:
                    url += f"&{key}=is.null"
                else:
                    url += f"&{key}=eq.{value}"
        
        if order:
            url += f"&order={order}"
        if limit:
            url += f"&limit={limit}"
            
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self._get_headers(access_token))
            if response.status_code == 200:
                return response.json()
            logger.error(f"Supabase select error: {response.status_code} - {response.text}")
            return []
    
    async def insert(
        self,
        table: str,
        data: Dict[str, Any],
        access_token: Optional[str] = None
    ) -> Optional[Dict]:
        """Insert a record into a table"""
        url = f"{self.rest_url}/{table}"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url, 
                json=data, 
                headers=self._get_headers(access_token)
            )
            if response.status_code in [200, 201]:
                result = response.json()
                return result[0] if isinstance(result, list) else result
            logger.error(f"Supabase insert error: {response.status_code} - {response.text}")
            return None
    
    async def update(
        self,
        table: str,
        data: Dict[str, Any],
        filters: Dict[str, Any],
        access_token: Optional[str] = None
    ) -> Optional[Dict]:
        """Update records in a table"""
        url = f"{self.rest_url}/{table}"
        
        for key, value in filters.items():
            url += f"?{key}=eq.{value}"
            
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                url,
                json=data,
                headers=self._get_headers(access_token)
            )
            if response.status_code == 200:
                result = response.json()
                return result[0] if isinstance(result, list) and result else result
            logger.error(f"Supabase update error: {response.status_code} - {response.text}")
            return None
    
    async def delete(
        self,
        table: str,
        filters: Dict[str, Any],
        access_token: Optional[str] = None
    ) -> bool:
        """Delete records from a table"""
        url = f"{self.rest_url}/{table}"
        
        for key, value in filters.items():
            url += f"?{key}=eq.{value}"
            
        async with httpx.AsyncClient() as client:
            response = await client.delete(url, headers=self._get_headers(access_token))
            return response.status_code in [200, 204]
    
    async def rpc(
        self,
        function_name: str,
        params: Optional[Dict[str, Any]] = None,
        access_token: Optional[str] = None
    ) -> Any:
        """Call a Supabase RPC function"""
        url = f"{self.rest_url}/rpc/{function_name}"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=params or {},
                headers=self._get_headers(access_token)
            )
            if response.status_code == 200:
                return response.json()
            logger.error(f"Supabase RPC error: {response.status_code} - {response.text}")
            return None

    async def get_user_from_token(self, access_token: str) -> Optional[Dict]:
        """Get user info from JWT token"""
        url = f"{self.auth_url}/user"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={'Authorization': f'Bearer {access_token}', 'apikey': self.api_key}
            )
            if response.status_code == 200:
                return response.json()
            return None


# Global client instance
supabase = SupabaseClient()
