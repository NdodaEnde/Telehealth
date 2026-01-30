/**
 * Quadcare Telehealth API Service
 * Centralized API calls to the FastAPI backend
 */

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface APIResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

class APIError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

/**
 * Get auth token from Supabase session
 */
const getAuthToken = async (): Promise<string | null> => {
  // Import dynamically to avoid circular dependencies
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

/**
 * Make authenticated API request
 */
async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new APIError(
      errorData.detail || errorData.message || 'API request failed',
      response.status
    );
  }
  
  return response.json();
}

// ============ User API ============

export const userAPI = {
  getProfile: () => apiRequest('/api/users/me'),
  
  updateProfile: (data: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    date_of_birth?: string;
  }) => apiRequest('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  getClinicians: (params?: { specialization?: string }) => {
    const query = params?.specialization ? `?specialization=${params.specialization}` : '';
    return apiRequest(`/api/users/clinicians${query}`);
  },
  
  getClinician: (id: string) => apiRequest(`/api/users/clinicians/${id}`),
  
  getClinicianAvailability: (id: string) => 
    apiRequest(`/api/users/clinicians/${id}/availability`),
  
  setAvailability: (data: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_available?: boolean;
  }) => apiRequest('/api/users/me/availability', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  deleteAvailability: (slotId: string) =>
    apiRequest(`/api/users/me/availability/${slotId}`, { method: 'DELETE' }),
};

// ============ Appointments API ============

export const appointmentsAPI = {
  list: (params?: { status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams}` : '';
    return apiRequest(`/api/appointments${query}`);
  },
  
  get: (id: string) => apiRequest(`/api/appointments/${id}`),
  
  create: (data: {
    clinician_id: string;
    scheduled_at: string;
    consultation_type?: 'video' | 'phone' | 'in_person';
    duration_minutes?: number;
    notes?: string;
    symptom_assessment_id?: string;
  }) => apiRequest('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: {
    status?: string;
    scheduled_at?: string;
    notes?: string;
  }) => apiRequest(`/api/appointments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  cancel: (id: string) => apiRequest(`/api/appointments/${id}`, { method: 'DELETE' }),
  
  createSymptomAssessment: (data: {
    symptoms: string[];
    severity: 'mild' | 'moderate' | 'severe';
    description?: string;
    recommended_specialization?: string;
  }) => apiRequest('/api/appointments/symptom-assessment', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  getTodayQueue: () => apiRequest('/api/appointments/queue/today'),
};

// ============ Prescriptions API ============

export const prescriptionsAPI = {
  list: (params?: { status?: string; patient_id?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.patient_id) searchParams.set('patient_id', params.patient_id);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams}` : '';
    return apiRequest(`/api/prescriptions${query}`);
  },
  
  get: (id: string) => apiRequest(`/api/prescriptions/${id}`),
  
  create: (data: {
    appointment_id: string;
    patient_id: string;
    medication_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity?: number;
    refills?: number;
    instructions?: string;
    pharmacy_notes?: string;
  }) => apiRequest('/api/prescriptions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: {
    status?: string;
    pharmacy_notes?: string;
  }) => apiRequest(`/api/prescriptions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  cancel: (id: string) => apiRequest(`/api/prescriptions/${id}/cancel`, { method: 'POST' }),
  
  getPDF: (id: string) => apiRequest(`/api/prescriptions/${id}/pdf`),
  
  generatePDF: (data: {
    prescription_id: string;
    patient_name: string;
    clinician_name: string;
    medication_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    prescribed_at: string;
    [key: string]: any;
  }) => apiRequest('/api/prescriptions/generate-pdf', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// ============ Clinical Notes API ============

export const clinicalNotesAPI = {
  list: (params?: { appointment_id?: string; patient_id?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.appointment_id) searchParams.set('appointment_id', params.appointment_id);
    if (params?.patient_id) searchParams.set('patient_id', params.patient_id);
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString() ? `?${searchParams}` : '';
    return apiRequest(`/api/clinical-notes${query}`);
  },
  
  get: (id: string) => apiRequest(`/api/clinical-notes/${id}`),
  
  getForAppointment: (appointmentId: string) => 
    apiRequest(`/api/clinical-notes/appointment/${appointmentId}`),
  
  create: (data: {
    appointment_id: string;
    patient_id: string;
    chief_complaint?: string;
    history_of_present_illness?: string;
    examination_findings?: string;
    diagnosis?: string[];
    diagnosis_codes?: string[];
    treatment_plan?: string;
    follow_up_instructions?: string;
    follow_up_date?: string;
    referral_required?: boolean;
    referral_details?: string;
    status?: 'draft' | 'final';
  }) => apiRequest('/api/clinical-notes', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Record<string, any>) => 
    apiRequest(`/api/clinical-notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  finalize: (id: string) => 
    apiRequest(`/api/clinical-notes/${id}/finalize`, { method: 'POST' }),
};

// ============ Auth API ============

export const authAPI = {
  requestPasswordReset: (email: string) =>
    apiRequest('/api/auth/password/reset-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  
  confirmPasswordReset: (token: string, newPassword: string) =>
    apiRequest('/api/auth/password/reset-confirm', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
  
  verifyToken: (token: string) =>
    apiRequest(`/api/auth/verify-token?token=${token}`),
};

// ============ Analytics API ============

export const analyticsAPI = {
  getDashboard: (days: number = 30) =>
    apiRequest(`/api/analytics/dashboard?days=${days}`),
  
  getOverview: () => apiRequest('/api/analytics/overview'),
};

// ============ Audit Logs API ============

export const auditAPI = {
  log: (data: {
    user_id: string;
    action: string;
    resource_type: string;
    resource_id: string;
    details?: Record<string, any>;
  }) => apiRequest('/api/audit-logs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  list: (params?: { user_id?: string; resource_type?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.user_id) searchParams.set('user_id', params.user_id);
    if (params?.resource_type) searchParams.set('resource_type', params.resource_type);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString() ? `?${searchParams}` : '';
    return apiRequest(`/api/audit-logs${query}`);
  },
};

// ============ Chat API ============

export const chatAPI = {
  // Conversations
  createConversation: (initialMessage: string) =>
    apiRequest('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ initial_message: initialMessage }),
    }),
  
  getConversations: (params?: { status?: string; assigned_to_me?: boolean; unassigned_only?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.assigned_to_me) searchParams.set('assigned_to_me', 'true');
    if (params?.unassigned_only) searchParams.set('unassigned_only', 'true');
    const query = searchParams.toString() ? `?${searchParams}` : '';
    return apiRequest(`/api/chat/conversations${query}`);
  },
  
  getUnassignedConversations: () =>
    apiRequest('/api/chat/conversations/unassigned'),
  
  getMyChats: () =>
    apiRequest('/api/chat/conversations/my-chats'),
  
  getConversation: (id: string) =>
    apiRequest(`/api/chat/conversations/${id}`),
  
  claimConversation: (id: string) =>
    apiRequest(`/api/chat/conversations/${id}/claim`, { method: 'POST' }),
  
  reassignConversation: (id: string, receptionistId: string) =>
    apiRequest(`/api/chat/conversations/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ receptionist_id: receptionistId }),
    }),
  
  updateConversationStatus: (id: string, status: string) =>
    apiRequest(`/api/chat/conversations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  
  updatePatientType: (id: string, patientType: string) =>
    apiRequest(`/api/chat/conversations/${id}/patient-type`, {
      method: 'PATCH',
      body: JSON.stringify({ patient_type: patientType }),
    }),
  
  // Messages
  getMessages: (conversationId: string, limit: number = 100) =>
    apiRequest(`/api/chat/conversations/${conversationId}/messages?limit=${limit}`),
  
  sendMessage: (conversationId: string, content: string, messageType: string = 'text', fileUrl?: string, fileName?: string) =>
    apiRequest(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        message_type: messageType,
        file_url: fileUrl,
        file_name: fileName,
      }),
    }),
  
  markAsRead: (conversationId: string) =>
    apiRequest(`/api/chat/conversations/${conversationId}/read`, { method: 'POST' }),
  
  // Stats
  getStats: () => apiRequest('/api/chat/stats'),
};

// ============ Bookings API ============

export const bookingsAPI = {
  getFeeSchedule: () => apiRequest('/api/bookings/fee-schedule'),
  
  getAvailableClinicians: () => apiRequest('/api/bookings/clinicians/available'),
  
  create: (data: {
    patient_id: string;
    clinician_id: string;
    conversation_id?: string;
    scheduled_at: string;
    service_type: string;
    billing_type: string;
    notes?: string;
    duration_minutes?: number;
  }) => apiRequest('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  list: (params?: { patient_id?: string; clinician_id?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.patient_id) searchParams.set('patient_id', params.patient_id);
    if (params?.clinician_id) searchParams.set('clinician_id', params.clinician_id);
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString() ? `?${searchParams}` : '';
    return apiRequest(`/api/bookings/${query}`);
  },
  
  get: (id: string) => apiRequest(`/api/bookings/${id}`),
  
  update: (id: string, data: { scheduled_at?: string; status?: string; clinician_id?: string; notes?: string }) =>
    apiRequest(`/api/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  cancel: (id: string) => apiRequest(`/api/bookings/${id}`, { method: 'DELETE' }),
  
  // Invoices
  getMyInvoices: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiRequest(`/api/bookings/invoices/my-invoices${query}`);
  },
  
  getInvoice: (id: string) => apiRequest(`/api/bookings/invoices/${id}`),
  
  getInvoicePDF: async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    const response = await fetch(`${BACKEND_URL}/api/bookings/invoices/${id}/pdf`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }
    
    return response.blob();
  },
  
  downloadInvoicePDF: async (id: string, filename?: string) => {
    try {
      const blob = await bookingsAPI.getInvoicePDF(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `invoice_${id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download invoice PDF:', error);
      throw error;
    }
  },
  
  updateInvoiceStatus: (id: string, status: string, paymentReference?: string) =>
    apiRequest(`/api/bookings/invoices/${id}/status?status=${status}${paymentReference ? `&payment_reference=${paymentReference}` : ''}`, {
      method: 'PATCH',
    }),
};

// ============ Video (Daily.co) API ============

export const videoAPI = {
  createRoom: (appointmentId: string) => 
    apiRequest('/api/video/room', {
      method: 'POST',
      body: JSON.stringify({ appointment_id: appointmentId }),
    }),
  
  createToken: (roomName: string, userName: string, isOwner: boolean = false) =>
    apiRequest('/api/video/token', {
      method: 'POST',
      body: JSON.stringify({ room_name: roomName, user_name: userName, is_owner: isOwner }),
    }),
  
  getRoom: (roomName: string) => apiRequest(`/api/video/room/${roomName}`),
  
  checkHealth: () => apiRequest('/api/video/health'),
};

// ============ Admin Analytics API ============

export const adminAnalyticsAPI = {
  getSummary: (period: string = 'month', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ period });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return apiRequest(`/api/admin/analytics/summary?${params}`);
  },
  
  getPeakTimes: (period: string = 'month', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ period });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return apiRequest(`/api/admin/analytics/peak-times?${params}`);
  },
  
  getCancellationStats: (period: string = 'month', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ period });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return apiRequest(`/api/admin/analytics/cancellation-reasons?${params}`);
  },
  
  getConversionFunnel: (period: string = 'month', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ period });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return apiRequest(`/api/admin/analytics/conversion-funnel?${params}`);
  },
  
  getNoShowRates: (period: string = 'month', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ period });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return apiRequest(`/api/admin/analytics/no-show-rates?${params}`);
  },
  
  getReceptionistWorkload: (period: string = 'month', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ period });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return apiRequest(`/api/admin/analytics/receptionist-workload?${params}`);
  },
  
  getTimestampTrends: (period: string = 'month', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ period });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return apiRequest(`/api/admin/analytics/timestamp-trends?${params}`);
  },
  
  exportCSV: async (period: string = 'month', startDate?: string, endDate?: string) => {
    const token = await getAuthToken();
    const params = new URLSearchParams({ period });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    
    const response = await fetch(`${BACKEND_URL}/api/admin/analytics/export/csv?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to export CSV');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quadcare_analytics_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

// ============ Bulk Import API ============

export const bulkImportAPI = {
  preview: async (file: File, password?: string) => {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }
    
    const response = await fetch(`${BACKEND_URL}/api/admin/bulk-import/preview`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(errorData.detail || 'Preview failed', response.status);
    }
    
    return response.json();
  },
  
  importStudents: async (file: File, password?: string) => {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }
    
    const response = await fetch(`${BACKEND_URL}/api/admin/bulk-import/students`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(errorData.detail || 'Import failed', response.status);
    }
    
    return response.json();
  },
  
  getTemplate: () => apiRequest('/api/admin/bulk-import/template'),
};

// Export all APIs
export const api = {
  user: userAPI,
  appointments: appointmentsAPI,
  prescriptions: prescriptionsAPI,
  clinicalNotes: clinicalNotesAPI,
  auth: authAPI,
  analytics: analyticsAPI,
  audit: auditAPI,
  chat: chatAPI,
  bookings: bookingsAPI,
  video: videoAPI,
  adminAnalytics: adminAnalyticsAPI,
  bulkImport: bulkImportAPI,
};

export default api;
