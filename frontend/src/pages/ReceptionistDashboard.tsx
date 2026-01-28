import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ChatProvider, useChat, Conversation } from "@/contexts/ChatContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { 
  MessageCircle, Users, Calendar, LogOut, Menu, X, 
  Inbox, CheckCircle, Clock, Loader2, UserPlus, Plus, XCircle, AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ChatConversationList } from "@/components/chat/ChatConversationList";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { chatAPI, bookingsAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatSAST } from "@/lib/timezone";

interface FeeScheduleItem {
  service_type: string;
  name: string;
  price: number;
  description: string;
}

interface Clinician {
  id: string;
  name: string;
  role: string;
  specialization?: string;
  is_available: boolean;
}

const ReceptionistDashboardContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, signOut, role } = useAuth();
  const {
    currentConversation,
    messages,
    isLoading,
    selectConversation,
    sendMessage,
    claimConversation,
    updateConversationStatus,
  } = useChat();

  const [activeTab, setActiveTab] = useState("unassigned");
  const [unassignedChats, setUnassignedChats] = useState<Conversation[]>([]);
  const [myChats, setMyChats] = useState<Conversation[]>([]);
  const [allChats, setAllChats] = useState<Conversation[]>([]);
  const [stats, setStats] = useState({ unassigned_count: 0, my_chats_count: 0, total_active: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Main view toggle: 'chat' or 'bookings'
  const [mainView, setMainView] = useState<'chat' | 'bookings'>('chat');
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Booking dialog state
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [feeSchedule, setFeeSchedule] = useState<FeeScheduleItem[]>([]);
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [bookingForm, setBookingForm] = useState({
    clinician_id: "",
    scheduled_at: "",
    service_type: "teleconsultation",
    billing_type: "cash",
    notes: "",
  });
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  
  // Cancel booking state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [currentBookingDetails, setCurrentBookingDetails] = useState<any>(null);
  const [selectedBookingToCancel, setSelectedBookingToCancel] = useState<any>(null);

  // Fetch booking details when conversation changes
  useEffect(() => {
    const fetchBookingDetails = async () => {
      if (currentConversation?.booking_id) {
        try {
          const bookings = await bookingsAPI.getAll();
          const booking = bookings.find((b: any) => b.id === currentConversation.booking_id);
          setCurrentBookingDetails(booking || null);
        } catch (error) {
          console.error("Error fetching booking:", error);
          setCurrentBookingDetails(null);
        }
      } else {
        setCurrentBookingDetails(null);
      }
    };
    fetchBookingDetails();
  }, [currentConversation?.booking_id]);

  // Load all bookings
  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const bookings = await bookingsAPI.getAll();
      // Sort by scheduled date, upcoming first
      const sorted = (bookings || []).sort((a: any, b: any) => 
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
      setAllBookings(sorted);
    } catch (error) {
      console.error("Error loading bookings:", error);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  // Load bookings when switching to bookings view
  useEffect(() => {
    if (mainView === 'bookings') {
      loadBookings();
    }
  }, [mainView, loadBookings]);

  // Handle cancel from bookings list
  const handleCancelFromList = async (booking: any) => {
    setSelectedBookingToCancel(booking);
    setShowCancelDialog(true);
  };

  const confirmCancelBooking = async () => {
    const bookingToCancel = selectedBookingToCancel || (currentConversation?.booking_id ? { id: currentConversation.booking_id } : null);
    if (!bookingToCancel?.id) return;
    
    setIsCancellingBooking(true);
    try {
      await bookingsAPI.cancel(bookingToCancel.id);
      toast({ title: "Booking cancelled", description: "The booking has been cancelled successfully" });
      setShowCancelDialog(false);
      setSelectedBookingToCancel(null);
      setCurrentBookingDetails(null);
      loadData();
      if (mainView === 'bookings') {
        loadBookings();
      }
    } catch (error: any) {
      toast({ title: "Error cancelling booking", description: error.message, variant: "destructive" });
    } finally {
      setIsCancellingBooking(false);
    }
  };

  // Load data
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [unassigned, mine, all, statsData] = await Promise.all([
        chatAPI.getUnassignedConversations(),
        chatAPI.getMyChats(),
        chatAPI.getConversations(),
        chatAPI.getStats(),
      ]);
      
      setUnassignedChats(unassigned || []);
      setMyChats(mine || []);
      setAllChats(all || []);
      setStats(statsData || { unassigned_count: 0, my_chats_count: 0, total_active: 0 });
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Load fee schedule and clinicians for booking
  useEffect(() => {
    const loadBookingData = async () => {
      try {
        const [fees, docs] = await Promise.all([
          bookingsAPI.getFeeSchedule(),
          bookingsAPI.getAvailableClinicians(),
        ]);
        setFeeSchedule(fees || []);
        setClinicians(docs || []);
        console.log("Loaded clinicians:", docs);
      } catch (error) {
        console.error("Error loading booking data:", error);
      }
    };
    loadBookingData();
  }, []);

  const handleClaimChat = async (conversationId: string) => {
    try {
      await claimConversation(conversationId);
      toast({ title: "Chat claimed", description: "You are now handling this conversation" });
      await loadData();
      setActiveTab("my-chats");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    await selectConversation(conversation.id);
  };

  const handleCreateBooking = async () => {
    if (!currentConversation || !bookingForm.clinician_id || !bookingForm.scheduled_at) {
      toast({ title: "Error", description: "Please select a clinician and date/time", variant: "destructive" });
      return;
    }

    setIsCreatingBooking(true);
    try {
      await bookingsAPI.create({
        patient_id: currentConversation.patient_id,
        clinician_id: bookingForm.clinician_id,
        conversation_id: currentConversation.id,
        scheduled_at: new Date(bookingForm.scheduled_at).toISOString(),
        service_type: bookingForm.service_type,
        billing_type: bookingForm.billing_type,
        notes: bookingForm.notes || undefined,
      });

      toast({ title: "Booking created", description: "The patient has been notified" });
      setShowBookingDialog(false);
      setBookingForm({
        clinician_id: "",
        scheduled_at: "",
        service_type: "teleconsultation",
        billing_type: "cash",
        notes: "",
      });
      
      // Refresh conversation
      await selectConversation(currentConversation.id);
      await loadData();
    } catch (error: any) {
      toast({ title: "Error creating booking", description: error.message, variant: "destructive" });
    } finally {
      setIsCreatingBooking(false);
    }
  };

  // Check if user has permission
  if (role !== "admin" && role !== "nurse" && role !== "doctor" && role !== "receptionist") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>Go Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">H</span>
            </div>
            <span className="font-bold text-lg hidden sm:block">Quadcare Reception</span>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <Button 
              variant={mainView === 'chat' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setMainView('chat')}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chats
            </Button>
            <Button 
              variant={mainView === 'bookings' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setMainView('bookings')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Bookings
            </Button>
          </div>
          
          {/* Stats */}
          <div className="hidden md:flex items-center gap-4">
            <Badge variant="secondary" className="gap-1">
              <Inbox className="w-3 h-3" />
              {stats.unassigned_count} Unassigned
            </Badge>
            <Badge variant="default" className="gap-1">
              <MessageCircle className="w-3 h-3" />
              {stats.my_chats_count} My Chats
            </Badge>
          </div>

          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {profile?.first_name || "Receptionist"}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Mobile Menu */}
          <button 
            className="sm:hidden p-2 hover:bg-accent rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4">
        {mainView === 'chat' ? (
        <div className="flex gap-4 h-[calc(100vh-120px)]">
          {/* Chat Queue Panel */}
          <Card className="w-80 shrink-0 flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Chat Queue</CardTitle>
                <Button variant="ghost" size="sm" onClick={loadData} disabled={refreshing}>
                  {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="grid grid-cols-3 mx-4">
                  <TabsTrigger value="unassigned" className="text-xs">
                    Unassigned
                    {stats.unassigned_count > 0 && (
                      <Badge variant="destructive" className="ml-1 px-1 py-0 text-xs">
                        {stats.unassigned_count}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="my-chats" className="text-xs">My Chats</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto">
                  <TabsContent value="unassigned" className="m-0 h-full">
                    {unassignedChats.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
                        <p>No unassigned chats</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {unassignedChats.map((conv) => (
                          <div key={conv.id} className="p-4 hover:bg-accent">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-sm">{conv.patient_name}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                  {conv.last_message}
                                </p>
                              </div>
                              <Badge variant="secondary" className="text-xs">New</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {conv.last_message_at && format(new Date(conv.last_message_at), "HH:mm")}
                              </span>
                              <Button size="sm" onClick={() => handleClaimChat(conv.id)}>
                                <UserPlus className="w-3 h-3 mr-1" />
                                Claim
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="my-chats" className="m-0 h-full">
                    <ChatConversationList
                      conversations={myChats}
                      selectedId={currentConversation?.id}
                      onSelect={handleSelectConversation}
                      showPatientName={true}
                    />
                  </TabsContent>

                  <TabsContent value="all" className="m-0 h-full">
                    <ChatConversationList
                      conversations={allChats}
                      selectedId={currentConversation?.id}
                      onSelect={handleSelectConversation}
                      showPatientName={true}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="flex-1 flex flex-col">
            {currentConversation ? (
              <>
                <CardHeader className="pb-2 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {currentConversation.patient_name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{currentConversation.status.replace('_', ' ')}</Badge>
                        {currentConversation.patient_type && (
                          <Badge variant="secondary">{currentConversation.patient_type.replace('_', ' ')}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Patient Type Selector */}
                      <Select
                        value={currentConversation.patient_type || ""}
                        onValueChange={async (value) => {
                          await chatAPI.updatePatientType(currentConversation.id, value);
                          await selectConversation(currentConversation.id);
                        }}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Patient Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medical_aid">Medical Aid</SelectItem>
                          <SelectItem value="campus_africa">Campus Africa</SelectItem>
                          <SelectItem value="university_student">University Student</SelectItem>
                          <SelectItem value="cash">Cash / Self-Pay</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Create Booking Button */}
                      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
                        <DialogTrigger asChild>
                          <Button disabled={currentConversation.status === 'booked' || !!currentBookingDetails}>
                            <Calendar className="w-4 h-4 mr-2" />
                            Create Booking
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Create Booking for {currentConversation.patient_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Clinical Associate *</Label>
                              <Select
                                value={bookingForm.clinician_id}
                                onValueChange={(v) => setBookingForm(f => ({ ...f, clinician_id: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select clinician" />
                                </SelectTrigger>
                                <SelectContent>
                                  {clinicians.length === 0 ? (
                                    <SelectItem value="" disabled>No clinicians available</SelectItem>
                                  ) : (
                                    clinicians.map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.name} ({c.specialization || c.role})
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              {clinicians.length === 0 && (
                                <p className="text-xs text-destructive">
                                  No clinicians found. Please create Clinical Associate accounts first.
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label>Date & Time *</Label>
                              <Input
                                type="datetime-local"
                                value={bookingForm.scheduled_at}
                                onChange={(e) => setBookingForm(f => ({ ...f, scheduled_at: e.target.value }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Service Type</Label>
                              <Select
                                value={bookingForm.service_type}
                                onValueChange={(v) => setBookingForm(f => ({ ...f, service_type: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {feeSchedule.map((fee) => (
                                    <SelectItem key={fee.service_type} value={fee.service_type}>
                                      {fee.name} - R{fee.price}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Billing Type</Label>
                              <Select
                                value={bookingForm.billing_type}
                                onValueChange={(v) => setBookingForm(f => ({ ...f, billing_type: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="medical_aid">Medical Aid</SelectItem>
                                  <SelectItem value="campus_africa">Campus Africa</SelectItem>
                                  <SelectItem value="university_student">University Student</SelectItem>
                                  <SelectItem value="cash">Cash / Self-Pay</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Notes (optional)</Label>
                              <Textarea
                                value={bookingForm.notes}
                                onChange={(e) => setBookingForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="e.g., Patient mentioned skin rash, see uploaded images"
                              />
                            </div>

                            {bookingForm.billing_type === 'cash' && (
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                  💰 Invoice will be auto-generated for cash patients
                                </p>
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowBookingDialog(false)}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={handleCreateBooking} 
                              disabled={isCreatingBooking || !bookingForm.clinician_id}
                            >
                              {isCreatingBooking ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                "Create Booking"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Cancel Booking Button - Only show when a booking exists */}
                      {currentBookingDetails && (
                        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                          <DialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel Booking
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="w-5 h-5" />
                                Cancel Booking
                              </DialogTitle>
                              <DialogDescription>
                                Are you sure you want to cancel this booking? This action cannot be undone.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <div className="p-4 bg-muted rounded-lg space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Patient</span>
                                  <span className="font-medium">{currentConversation.patient_name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Scheduled</span>
                                  <span className="font-medium">
                                    {currentBookingDetails.scheduled_at 
                                      ? formatSAST(currentBookingDetails.scheduled_at, "MMM d, yyyy 'at' HH:mm")
                                      : "N/A"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Service</span>
                                  <span className="font-medium">{currentBookingDetails.service_type}</span>
                                </div>
                                {currentBookingDetails.clinician_name && (
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Clinician</span>
                                    <span className="font-medium">{currentBookingDetails.clinician_name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                                Keep Booking
                              </Button>
                              <Button 
                                variant="destructive"
                                onClick={handleCancelBooking}
                                disabled={isCancellingBooking}
                              >
                                {isCancellingBooking ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Cancelling...
                                  </>
                                ) : (
                                  "Yes, Cancel Booking"
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <ChatMessageList messages={messages} currentUserId={user?.id} />
                
                <ChatInput 
                  onSend={sendMessage} 
                  disabled={currentConversation.status === 'closed'}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <Users className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Conversation</h3>
                <p className="text-muted-foreground">
                  Choose a chat from the queue to start helping patients
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

// Wrap with ChatProvider
const ReceptionistDashboard = () => {
  return (
    <ChatProvider>
      <ReceptionistDashboardContent />
    </ChatProvider>
  );
};

export default ReceptionistDashboard;
