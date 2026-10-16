'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Plus, Minus, Check, ShieldCheck, ArrowRight, ArrowLeft, X, Eye, EyeOff, Search, Package, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import QRCode from 'react-qr-code';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const MapPicker = dynamic(() => import('../components/MapPicker'), {
  ssr: false,
  loading: () => <div className="w-full h-48 flex items-center justify-center bg-gray-100 text-gray-500 text-sm">Loading Map...</div>
});

type Product = {
  id: string;
  name: string;
  tier: string;
  price: number;
  image: string;
  inStock: boolean;
};

const initialProducts: Product[] = [
  { id: 'premium', tier: 'PREMIUM', name: 'Deep Gold Double', price: 300, image: 'https://images.unsplash.com/photo-1699764681875-dd04ce36b1c3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900', inStock: true },
  { id: 'medium', tier: 'MEDIUM', name: 'Bright Orange', price: 150, image: 'https://images.unsplash.com/photo-1572711330402-3e16e1ee2ad3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900', inStock: true },
  { id: 'standard', tier: 'STANDARD', name: 'Yellow Marigold', price: 200, image: 'https://images.unsplash.com/photo-1709987632881-515bb5a53227?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjB8fG1hcmlnb2xkJTIwZmxvd2VyfGVufDB8fDB8fHww', inStock: true },
];

export default function BookingFlow() {
  const [currentView, setCurrentView] = useState<'booking' | 'auth' | 'tracking' | 'orders'>('booking');
  const [step, setStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    date: '',
    houseNumber: '',
    streetName: '',
    landmark: '',
    coordinates: [17.5144, 78.6472] as [number, number],
  });
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cod'>('upi');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  const [pastOrders, setPastOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const { user, isLoading: isAuthContextLoading } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Auth State
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [isVerifyingSession, setIsVerifyingSession] = useState(false);
  const [autoFilled, setAutoFilled] = useState({ fullName: false, phone: false });

  // Tracking State
  const [searchQuery, setSearchQuery] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [hasConfirmedPayment, setHasConfirmedPayment] = useState(false);

  const cartTotal = products.reduce((acc, p) => acc + (p.price * (cart[p.id] || 0)), 0);
  const totalWeight = products.reduce((acc, p) => acc + (cart[p.id] || 0), 0);

  const UPI_ID = "6304693028-3@ibl";
  const PAYEE_NAME = "Harihara Agro Farm";
  const upiString = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${cartTotal}&cu=INR`;

  const updateCart = (id: string, qty: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (qty <= 0) delete newCart[id];
      else newCart[id] = qty;
      return newCart;
    });
  };

  const pageVariants = {
    initial: (dir: number) => ({ opacity: 0, x: dir > 0 ? 20 : -20 }),
    in: { opacity: 1, x: 0 },
    out: (dir: number) => ({ opacity: 0, x: dir > 0 ? -20 : 20 })
  };

  const pageTransition = {
    type: 'tween' as const,
    ease: 'anticipate' as const,
    duration: 0.4
  };

  const nextStep = () => {
    setDirection(1);
    window.scrollTo(0, 0);
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setDirection(-1);
    window.scrollTo(0, 0);
    setStep(prev => prev - 1);
  };

  React.useEffect(() => {
    if (step === 2 && user) {
      let updatedFormData = { ...formData };
      let newlyFilled = { ...autoFilled };

      const storedName = user.user_metadata?.full_name;
      if (storedName && !formData.fullName) {
        updatedFormData.fullName = storedName;
        newlyFilled.fullName = true;
      }

      setFormData(updatedFormData);
      setAutoFilled(newlyFilled);

      if (newlyFilled.fullName) {
        setTimeout(() => setAutoFilled({ fullName: false, phone: false }), 3000);
      }
    }

    if (currentView === 'orders' && user) {
      const fetchOrders = async () => {
        setIsLoadingOrders(true);
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setPastOrders(data);
        }
        setIsLoadingOrders(false);
      };
      fetchOrders();
    }
  }, [step, user, currentView]);

  React.useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const handleProceedToStep2 = () => {
    setIsVerifyingSession(true);
    setTimeout(() => {
      setIsVerifyingSession(false);
      if (user) {
        nextStep();
      } else {
        setDirection(1);
        setCurrentView('auth');
      }
    }, 600);
  };


  
  const isStepAchieved = (orderStatus: string, stepStatus: string) => {
    const statuses = ["Order Reserved", "Order Confirmed", "Harvested", "Out for Delivery", "Delivered"];
    const orderIdx = statuses.indexOf(orderStatus || "Order Reserved");
    const stepIdx = statuses.indexOf(stepStatus);
    return orderIdx >= stepIdx;
  };

const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) console.error("Error logging in with Google:", error.message);
  };

  const handleBack = () => {
    setDirection(-1);
    window.scrollTo(0, 0);
    if (currentView !== 'booking') {
      setCurrentView('booking');
    } else if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;
    if (name === 'fullName') value = value.replace(/[^a-zA-Z\s]/g, '');
    else if (name === 'phone') value = value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            coordinates: [position.coords.latitude, position.coords.longitude]
          }));
          setIsLocating(false);
        },
        (error) => {
          alert("Failed to fetch location.");
          setIsLocating(false);
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const getMinDate = () => {
    const now = new Date();
    if (now.getHours() >= 9) now.setDate(now.getDate() + 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleProceedToStep3 = () => {
    if (!formData.fullName.trim()) {
      alert("Please enter your full name.");
      return;
    }
    if (formData.phone.length !== 10) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }
    if (!formData.date) {
      alert("Please select a delivery date.");
      return;
    }
    if (!formData.coordinates[0] || !formData.coordinates[1]) {
      alert("Please drop a pin on the map or click 'Use My Current Location'.");
      return;
    }
    if (!formData.houseNumber.trim() || !formData.streetName.trim()) {
      alert("Please enter your House/Flat number and Street name.");
      return;
    }
    nextStep();
  };

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    try {
      if (!user) {
        alert("Must be logged in to order.");
        return;
      }

      const order_items = products
        .filter(p => (cart[p.id] || 0) > 0)
        .map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          quantity_kg: cart[p.id]
        }));

      const payload = {
        user_id: user.id,
        customer_email: user.email,
        customer_name: formData.fullName || 'N/A',
        customer_phone: formData.phone || 'N/A',
        house_number: formData.houseNumber || 'N/A',
        street_name: formData.streetName || 'N/A',
        landmark: formData.landmark || 'N/A',
        delivery_lat: Number(formData.coordinates[0]),
        delivery_lng: Number(formData.coordinates[1]),
        order_items: order_items,
        total_amount: Number(cartTotal),
        delivery_date: formData.date || getMinDate(),
        payment_method: paymentMethod.toUpperCase(),
        payment_status: 'pending'
      };

      console.log("Submitting payload:", payload);

      const { data, error } = await supabase.from('orders').insert(payload).select().single();

      if (error) {
        console.error("Insert Error:", error?.message || error, error?.details, error?.hint);
        alert("Failed to submit order. Please try again.");
      } else {
        setConfirmedOrder({ id: data.order_code || data.id, ...data });
        setStep(1);
        setCurrentView('booking');
        setCart({});
        setFormData({
          fullName: '',
          phone: '',
          date: '',
          houseNumber: '',
          streetName: '',
          landmark: '',
          coordinates: [17.5144, 78.6472],
        });
        setHasConfirmedPayment(false);
        setShowSuccessToast(true);
        window.scrollTo(0, 0);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to submit order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateTo = (view: 'booking' | 'auth' | 'tracking' | 'orders') => {
    setIsMenuOpen(false);
    setDirection(1);
    window.scrollTo(0, 0);
    setCurrentView(view);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#FAFAF7] shadow-2xl relative overflow-x-hidden flex flex-col font-sans text-gray-800">

      {/* Slide-out Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 max-w-md mx-auto"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', ease: 'easeOut', duration: 0.3 }}
              className="fixed top-0 right-0 bottom-0 w-[80%] max-w-[320px] bg-white z-[60] shadow-2xl flex flex-col p-6"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="font-bold tracking-widest text-sm flex items-center gap-2 text-[#1F3822]">
                  <span className="text-amber-500">✤</span> HARIHARA
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="text-gray-500 hover:text-gray-800">
                  <X size={24} />
                </button>
              </div>

              {!user && (
                <div className="flex flex-col gap-4 mb-6">
                  <button
                    onClick={() => navigateTo('auth')}
                    className="w-full bg-[#1F3822] text-white font-bold py-4 rounded-xl text-center shadow-lg hover:bg-[#2c4d3b] transition-colors uppercase tracking-wide text-xs"
                  >
                    Log In / Sign Up
                  </button>
                </div>
              )}

              {user && (
                <div className="flex flex-col gap-4 mb-6">
                  <button
                    onClick={() => navigateTo('orders')}
                    className="w-full bg-white border-2 border-[#1F3822] text-[#1F3822] font-bold py-4 rounded-xl text-center hover:bg-gray-50 transition-colors uppercase tracking-wide text-xs flex items-center justify-center gap-2"
                  >
                    👤 My Profile
                  </button>
                </div>
              )}

              <div className="mt-auto flex flex-col gap-6 items-center">
                {user && (
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setIsMenuOpen(false);
                      navigateTo('booking');
                    }}
                    className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-wide text-xs"
                  >
                    Log Out
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Universal Header */}
      <header className={`absolute top-0 left-0 right-0 z-40 px-6 py-6 flex justify-between items-center transition-colors duration-300 ${(currentView === 'booking' && step === 3) || currentView === 'tracking' || currentView === 'orders' ? 'text-[#1F3822]' :
        (currentView === 'booking' && step === 1) ? 'text-white drop-shadow-md' : 'text-[#1F3822]'
        }`}>
        {(currentView !== 'booking' || step > 1) ? (
          <button
            onClick={handleBack}
            className={`flex items-center hover:text-amber-600 transition-colors font-bold z-20 rounded-full p-2 ${(currentView === 'booking' && step === 1) ? 'bg-white/20 backdrop-blur text-white' : 'bg-white/80 backdrop-blur shadow-sm text-[#1F3822]'
              }`}
          >
            <ArrowLeft size={24} />
          </button>
        ) : (
          <div className="font-bold tracking-widest text-sm flex items-center gap-2 text-white">
            <span className="text-amber-300">✤</span> HARIHARA AGRO FARM
          </div>
        )}

        {currentView === 'orders' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1 className="font-bold text-[#1F3822] text-xl">My Profile</h1>
          </div>
        )}

        {currentView === 'booking' && step < 4 && (
          <button
            className={`drop-shadow-md rounded-full p-2 ${step > 1 ? 'bg-white/80 backdrop-blur shadow-sm text-[#1F3822]' : 'text-white'}`}
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={24} />
          </button>
        )}
      </header>

      <main className="flex-1 pb-32">
        <AnimatePresence mode="wait" custom={direction}>

          {/* MY PROFILE VIEW */}
          {currentView === 'orders' && (
            <motion.div
              key="orders" custom={direction} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
              className="pt-24 px-6 min-h-screen flex flex-col pb-32"
            >
              {user && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8 flex flex-col items-center">
                  <div className="w-16 h-16 bg-[#1F3822] text-white rounded-full flex items-center justify-center text-2xl font-bold mb-3">
                    {user.user_metadata?.full_name?.charAt(0) || 'U'}
                  </div>
                  <h2 className="text-[#1F3822] font-bold text-xl mb-1">{user.user_metadata?.full_name || 'User'}</h2>
                  <p className="text-gray-500 mb-6">{user.email}</p>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigateTo('booking');
                    }}
                    className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-wide text-xs"
                  >
                    Log Out
                  </button>
                </div>
              )}

              <h3 className="font-bold text-[#1F3822] text-lg mb-4">My Orders</h3>
              <div className="flex flex-col gap-4">
                {isLoadingOrders ? (
                  <div className="flex justify-center items-center py-20 text-[#1F3822]">
                    <Loader2 size={32} className="animate-spin" />
                  </div>
                ) : pastOrders.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    No past orders found.
                  </div>
                ) : pastOrders.map(order => (
                  <div key={order.order_code || order.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-[#1F3822]">{order.order_code || order.id}</span>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="mb-4 flex flex-col gap-2">
                      {order.order_items?.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <p className="text-[#1F3822] font-semibold text-sm">{item.name}</p>
                          <p className="text-gray-500 text-sm font-medium">{item.quantity_kg} kg</p>
                        </div>
                      ))}
                      {!order.order_items && (
                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <p className="text-[#1F3822] font-semibold text-sm">{order.product_tier}</p>
                          <p className="text-gray-500 text-sm font-medium">{order.quantity_kg} kg</p>
                        </div>
                      )}
                    </div>
                    <div className="p-3 rounded-xl mb-6 text-sm flex items-center justify-between bg-gray-50 border border-gray-100">
                      <span className="font-bold text-[#1F3822]">Total: ₹{order.total_amount?.toLocaleString() || 0}</span>
                      {order.payment_method === 'COD' ? (
                        <span className="flex items-center space-x-1.5 border border-gray-200 bg-gray-50 text-gray-600 px-3 py-1 rounded-full text-[10px] tracking-wider uppercase font-bold">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>Cash on Delivery</span>
                        </span>
                      ) : order.payment_status === 'pending' || !order.payment_status ? (
                        <span className="flex items-center space-x-1.5 border border-amber-200 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] tracking-wider uppercase font-bold">
                          <svg className="animate-spin h-3 w-3 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Verification Pending</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] tracking-wider uppercase font-bold">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Payment Confirmed</span>
                        </span>
                      )}
                    </div>

                    <div className="relative pl-6 py-2">
                      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200"></div>

                      {/* Reserved */}
                      <div className="relative mb-6">
                        <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${order.order_status === 'Order Reserved' ? 'bg-amber-500 border-4 border-white' : 'bg-green-500 border-2 border-white text-white'
                          }`}>
                          {order.order_status === 'Order Reserved' ? <div className="w-1.5 h-1.5 bg-white rounded-full"></div> : <Check size={10} strokeWidth={4} />}
                        </div>
                        <h4 className={`font-bold text-sm ${order.order_status === 'Order Reserved' ? 'text-amber-600' : 'text-[#1F3822]'}`}>Order Reserved</h4>
                      </div>

                      {/* Confirmed */}
                      <div className="relative mb-6">
                        <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${order.order_status === 'Order Reserved' ? 'bg-gray-200 border-2 border-white' :
                          order.order_status === 'Order Confirmed' ? 'bg-amber-500 border-4 border-white' : 'bg-green-500 border-2 border-white text-white'
                          }`}>
                          {order.order_status === 'Order Confirmed' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                          {order.order_status !== 'Order Reserved' && order.order_status !== 'Order Confirmed' && <Check size={10} strokeWidth={4} />}
                        </div>
                        <h4 className={`font-bold text-sm ${order.order_status === 'Order Confirmed' ? 'text-amber-600' : order.order_status === 'Order Reserved' ? 'text-gray-400' : 'text-[#1F3822]'}`}>Order Confirmed</h4>
                      </div>

                      {/* Harvested */}
                      <div className="relative mb-6">
                        <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${['Order Reserved', 'Order Confirmed'].includes(order.order_status) || !order.order_status ? 'bg-gray-200 border-2 border-white' :
                          order.order_status === 'Harvested' ? 'bg-amber-500 border-4 border-white' : 'bg-green-500 border-2 border-white text-white'
                          }`}>
                          {order.order_status === 'Harvested' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                          {!['Order Reserved', 'Order Confirmed', 'Harvested'].includes(order.order_status) && order.order_status && <Check size={10} strokeWidth={4} />}
                        </div>
                        <h4 className={`font-bold text-sm ${order.order_status === 'Harvested' ? 'text-amber-600' : ['Order Reserved', 'Order Confirmed'].includes(order.order_status) || !order.order_status ? 'text-gray-400' : 'text-[#1F3822]'}`}>Harvested</h4>
                      </div>

                      {/* Out for Delivery */}
                      <div className="relative mb-6">
                        <div className={`absolute -left-[23px] top-1 w-4 h-4 rounded-full border-2 ${order.order_status === 'Out for Delivery' ? 'bg-amber-500 border-white shadow-sm ring-2 ring-amber-200' :
                          order.order_status === 'Delivered' ? 'bg-green-500 border-white shadow-sm' : 'bg-gray-100 border-gray-300'
                          }`}></div>
                        <h4 className={`font-bold text-sm ${order.order_status === 'Out for Delivery' ? 'text-amber-600' : order.order_status === 'Delivered' ? 'text-[#1F3822]' : 'text-gray-400'}`}>Out for Delivery</h4>
                      </div>

                      {/* Delivered */}
                      <div className="relative">
                        <div className={`absolute -left-[23px] top-1 w-4 h-4 rounded-full border-2 ${order.order_status === 'Delivered' ? 'bg-green-500 border-white shadow-sm' : 'bg-gray-100 border-gray-300'
                          }`}></div>
                        <h4 className={`font-bold text-sm ${order.order_status === 'Delivered' ? 'text-[#1F3822]' : 'text-gray-400'}`}>Delivered</h4>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TRACKING VIEW */}
          {currentView === 'tracking' && (
            <motion.div
              key="tracking" custom={direction} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
              className="pt-24 px-6 min-h-screen flex flex-col"
            >
              <div className="mb-8">
                <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Order Status</div>
                <h2 className="text-[#1F3822] font-bold text-3xl leading-tight mb-3">Track Order</h2>
                <p className="text-gray-500 text-sm">Enter your Order ID to see real-time harvest status.</p>
              </div>

              <div className="flex gap-2 mb-10">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  placeholder="e.g., MG-1049"
                  className="flex-1 p-4 bg-white border border-gray-200 rounded-xl focus:border-[#1F3822] focus:ring-2 focus:ring-[#1F3822]/20 outline-none text-gray-800 font-bold placeholder-gray-400"
                />
                <button
                  onClick={() => { if (searchQuery.length > 3) setIsTracking(true) }}
                  className="bg-[#1F3822] text-white p-4 rounded-xl hover:bg-[#2c4d3b] transition-colors"
                >
                  <Search size={24} />
                </button>
              </div>

              {isTracking && (
                <div className="flex-1">
                  <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100 mb-8">
                    <div className="relative pl-8 py-2">
                      <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200"></div>

                      <div className="relative mb-8">
                        <div className="absolute -left-8 top-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-sm text-white border-2 border-white">
                          <Check size={16} strokeWidth={3} />
                        </div>
                        <h4 className="font-bold text-[#1F3822] text-lg mb-1">Order Reserved</h4>
                        <p className="text-sm text-gray-500">We've received your request.</p>
                      </div>

                      <div className="relative mb-8">
                        <div className="absolute -left-8 top-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-sm text-white border-2 border-white">
                          <Check size={16} strokeWidth={3} />
                        </div>
                        <h4 className="font-bold text-[#1F3822] text-lg mb-1">Order Confirmed</h4>
                        <p className="text-sm text-gray-500">Payment secured via UPI.</p>
                      </div>

                      <div className="relative mb-8">
                        <div className="absolute -left-8 top-0 w-8 h-8 bg-amber-500 rounded-full border-4 border-white flex items-center justify-center shadow-sm">
                          <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                        </div>
                        <h4 className="font-bold text-amber-600 text-lg mb-1">Harvested</h4>
                        <p className="text-sm text-gray-600">Fresh picking completed.</p>
                      </div>

                      <div className="relative mb-8">
                        <div className="absolute -left-7 top-1 w-6 h-6 bg-gray-100 rounded-full border-2 border-gray-300"></div>
                        <h4 className="font-bold text-gray-400 text-lg mb-1">Out for Delivery</h4>
                        <p className="text-sm text-gray-400">Pending</p>
                      </div>

                      <div className="relative">
                        <div className="absolute -left-7 top-1 w-6 h-6 bg-gray-100 rounded-full border-2 border-gray-300"></div>
                        <h4 className="font-bold text-gray-400 text-lg mb-1">Delivered</h4>
                        <p className="text-sm text-gray-400">Pending</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 border border-gray-100">
                    <h3 className="font-bold text-[#1F3822] mb-4">Order Summary</h3>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Items</span>
                      <span className="font-bold text-gray-800">Premium Marigold · 20 kg</span>
                    </div>
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-gray-500">Total Paid</span>
                      <span className="font-bold text-gray-800">₹6,000 (UPI)</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* AUTH VIEW */}
          {currentView === 'auth' && (
            <motion.div
              key="auth" custom={direction} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
              className="pt-24 px-6 min-h-screen flex flex-col bg-white z-50 absolute inset-0 max-w-md mx-auto overflow-y-auto"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                  <span className="text-amber-500 text-3xl">✤</span>
                </div>
                <h2 className="text-[#1F3822] font-bold text-3xl leading-tight mb-2">Harihara Agro Farm</h2>
                <p className="text-gray-500 text-sm">Log in or create an account to manage your festive orders.</p>
              </div>

<div className="flex flex-col gap-4 mb-6">
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* BOOKING FLOW */}
          {currentView === 'booking' && step === 1 && (
            <motion.div
              key="step1" custom={direction} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
            >
              <div
                className="h-72 bg-cover bg-center relative flex flex-col justify-end p-6"
                style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1699764681875-dd04ce36b1c3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900")' }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#1F3822]/90 via-[#1F3822]/40 to-transparent"></div>
                <div className="relative z-10 mb-2">
                  <div className="text-amber-300 text-xs font-bold tracking-widest mb-2 uppercase">Farm Fresh · Hyderabad</div>
                  <h1 className="text-white font-bold text-4xl leading-tight mb-2">Celebrate in<br />full bloom.</h1>
                  <p className="text-white/90 text-sm max-w-[280px]">Fresh marigolds harvested at dawn and delivered to your celebration.</p>
                </div>
              </div>

              <div className="px-6 pt-8 pb-10">
                <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Choose your bloom</div>
                <h2 className="text-[#1F3822] font-bold text-2xl mb-6">Today's harvest</h2>

                <div className="flex flex-col gap-0 mb-8">
                  {products.map(product => {
                    const qty = cart[product.id] || 0;
                    const isSelected = qty > 0;
                    const isOutOfStock = !product.inStock;
                    return (
                      <div
                        key={product.id}
                        className={`flex flex-col p-3 mb-4 bg-white border rounded-2xl shadow-sm transition-all ${isOutOfStock ? 'opacity-50 border-gray-200' : ''
                          } ${isSelected && !isOutOfStock ? 'border-2 border-amber-600 bg-amber-50' : 'border-gray-200'
                          }`}
                      >
                        <div className="flex items-center">
                          <div className="relative">
                            <img src={product.image} alt={product.name} className="w-16 h-16 rounded-xl object-cover mr-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{product.tier}</div>
                              <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-gray-400' : 'bg-green-500'}`}></span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase">{isOutOfStock ? 'Out of Stock' : 'In Stock'}</span>
                              </div>
                            </div>
                            <h3 className="font-bold text-[#1F3822] text-lg leading-tight mb-1">{product.name}</h3>
                            <p className="text-gray-500 text-sm font-medium">₹{product.price} / kg</p>
                          </div>
                        </div>

                        {!isOutOfStock && (
                          <div className="mt-3 flex justify-end">
                            <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm h-10">
                              <button
                                className="w-10 h-full flex items-center justify-center text-amber-600 hover:bg-amber-50 active:bg-amber-100 transition-colors"
                                onClick={() => updateCart(product.id, qty - 1)}
                              >
                                <Minus size={16} />
                              </button>
                              <div className="w-12 h-full flex items-center justify-center text-sm font-bold bg-gray-50 text-[#1F3822] border-x border-gray-100">
                                {qty}
                              </div>
                              <button
                                className="w-10 h-full flex items-center justify-center text-amber-600 hover:bg-amber-50 active:bg-amber-100 transition-colors"
                                onClick={() => updateCart(product.id, qty + 1)}
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 p-4 pb-8 z-[9999] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button
                  onClick={handleProceedToStep2}
                  disabled={cartTotal === 0 || isVerifyingSession || isAuthContextLoading}
                  className="w-full bg-[#D98310] text-white font-bold text-sm sm:text-base py-4 rounded-xl shadow-lg hover:bg-amber-700 transition-colors uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-2"
                >
                  {isVerifyingSession ? <Loader2 size={18} className="animate-spin" /> : `Total: ₹${cartTotal} (${totalWeight} kg) -> CONTINUE`}
                </button>
              </div>
            </motion.div>
          )}

          {currentView === 'booking' && step === 2 && (
            <motion.div
              key="step2" custom={direction} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
              className="pt-24 px-6"
            >
              <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Step 2 of 3</div>
              <h2 className="text-[#1F3822] font-bold text-3xl leading-tight mb-3">Where should we deliver?</h2>
              <p className="text-gray-500 text-sm mb-8">Enter your details for a smooth festival delivery.</p>

              {user && (
                <div className="flex flex-col gap-1 mb-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Account Email</label>
                  <div className="w-full p-4 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-medium flex items-center justify-between">
                    <span>{user.email}</span>
                    <Check size={18} className="text-green-500" />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1 mb-4 relative">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text" name="fullName" value={formData.fullName} onChange={handleInputChange}
                    className={`w-full p-4 bg-white border ${autoFilled.fullName ? 'border-green-500 ring-2 ring-green-500/20' : 'border-gray-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20'} rounded-xl outline-none text-gray-800 font-medium placeholder-gray-400 transition-all`}
                    placeholder="e.g. Priya Reddy"
                  />
                  {autoFilled.fullName && <Check size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" />}
                </div>
              </div>

              <div className="flex flex-col gap-1 mb-4 relative">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Phone Number</label>
                <div className="relative">
                  <input
                    type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                    className={`w-full p-4 bg-white border ${autoFilled.phone ? 'border-green-500 ring-2 ring-green-500/20' : 'border-gray-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20'} rounded-xl outline-none text-gray-800 font-medium placeholder-gray-400 transition-all`}
                    placeholder="+91 98765 43210"
                  />
                  {autoFilled.phone && <Check size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" />}
                </div>
              </div>

              <div className="flex flex-col gap-1 mb-6">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Delivery Date</label>
                <input
                  type="date" name="date" value={formData.date} onChange={handleInputChange}
                  min={getMinDate()} onKeyDown={(e) => e.preventDefault()}
                  className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none text-gray-800 font-medium"
                />
              </div>

              <div className="flex flex-col gap-1 mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Location Pin</label>
                <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200 shadow-sm mt-2">
                  <MapPicker
                    position={formData.coordinates}
                    setPosition={(pos: [number, number]) => setFormData(prev => ({ ...prev, coordinates: pos }))}
                  />
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    className="absolute bottom-3 right-3 z-[9999] flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-md text-[#1F3822] hover:text-[#D98310] hover:bg-gray-50 transition-colors border border-gray-100"
                    aria-label="Use my current location"
                  >
                    {isLocating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">House / Flat Number</label>
                <input
                  type="text" name="houseNumber" value={formData.houseNumber} onChange={handleInputChange}
                  className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none text-gray-800 font-medium placeholder-gray-400"
                  placeholder="e.g. Flat 301, Tower B"
                />
              </div>

              <div className="flex flex-col gap-1 mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Street Name</label>
                <input
                  type="text" name="streetName" value={formData.streetName} onChange={handleInputChange}
                  className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none text-gray-800 font-medium placeholder-gray-400"
                  placeholder="e.g. Jubilee Hills Road No. 36"
                />
              </div>

              <div className="flex flex-col gap-1 mb-8">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Landmark (Optional)</label>
                <input
                  type="text" name="landmark" value={formData.landmark} onChange={handleInputChange}
                  className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none text-gray-800 font-medium placeholder-gray-400"
                  placeholder="e.g. Opposite Metro Station"
                />
              </div>

              <hr className="border-gray-200 mb-6" />

              <div className="flex flex-col gap-2 mb-10 pb-8">
                <h3 className="font-bold text-[#1F3822] mb-2">Order Summary</h3>
                {products.filter(p => (cart[p.id] || 0) > 0).map(p => (
                  <div key={p.id} className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">{p.name} · {cart[p.id]} kg</span>
                    <span className="text-[#1F3822] font-medium">₹{(p.price * cart[p.id]).toLocaleString()}</span>
                  </div>
                ))}
                <hr className="border-gray-200 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-bold">Total ({totalWeight} kg)</span>
                  <span className="text-[#1F3822] font-bold text-xl">₹{cartTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 p-4 pb-8 z-[9999] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button
                  onClick={handleProceedToStep3}
                  className="w-full bg-[#D98310] text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:bg-amber-700 transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
                >
                  REVIEW & PAY <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {currentView === 'booking' && step === 3 && (
            <motion.div
              key="step3" custom={direction} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
              className="bg-[#1F3822] min-h-screen pt-12 flex flex-col relative z-0"
            >
              <div className="px-6 text-center text-white mb-8 mt-6">
                <div className="w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-[#1F3822]" strokeWidth={2.5} />
                </div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">Order Reserved</div>
                <h2 className="font-bold text-3xl leading-tight mb-3">Complete your payment</h2>
                <p className="text-white/80 text-sm">Scan with any UPI app to confirm your harvest, or select cash on delivery.</p>
              </div>

              <div className="flex-1 bg-[#FAFAF7] rounded-t-3xl px-6 pt-8 pb-32">

                <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
                  <button
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${paymentMethod === 'upi' ? 'bg-white text-[#1F3822] shadow-sm' : 'text-gray-500'}`}
                    onClick={() => setPaymentMethod('upi')}
                  >
                    UPI Payment
                  </button>
                  <button
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${paymentMethod === 'cod' ? 'bg-white text-[#1F3822] shadow-sm' : 'text-gray-500'}`}
                    onClick={() => setPaymentMethod('cod')}
                  >
                    Cash on Delivery
                  </button>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-200/50 flex flex-col items-center border border-gray-100 mb-8 relative">

                  <AnimatePresence mode="wait">
                    {paymentMethod === 'upi' ? (
                      <motion.div
                        key="upi-box" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center w-full"
                      >
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-center mt-2">
                          <QRCode value={upiString} size={180} level="H" />
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-2 mb-4">Scan with any UPI app</p>

                        <a
                          href={upiString}
                          className="mb-6 flex items-center justify-center w-full py-3 bg-[#1F3822] text-white rounded-lg font-medium shadow-md hover:bg-[#152718] transition-colors"
                        >
                          Pay ₹{cartTotal.toLocaleString()} via UPI App
                        </a>

                        <label className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4 cursor-pointer text-left w-full">
                          <input
                            type="checkbox"
                            checked={hasConfirmedPayment}
                            onChange={(e) => setHasConfirmedPayment(e.target.checked)}
                            className="mt-1 w-5 h-5 text-yellow-600 rounded focus:ring-yellow-500 flex-shrink-0"
                          />
                          <span className="text-sm text-yellow-800">
                            <strong>I confirm the transfer is successful.</strong> I understand my order will be cancelled if the payment is not received in the farm's bank account.
                          </span>
                        </label>

                        <div className="text-center">
                          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Amount Payable</div>
                          <div className="text-4xl font-bold text-[#1F3822] mb-4">₹{cartTotal.toLocaleString()}</div>
                          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold">
                            UPI · SECURE PAYMENT
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="cod-box" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center w-full py-8 text-center"
                      >
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Amount Payable</div>
                        <div className="text-4xl font-bold text-[#1F3822] mb-4">₹{cartTotal.toLocaleString()}</div>
                        <p className="text-gray-500 text-sm mb-4">Please keep exact change ready for a smooth delivery.</p>
                        <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-xs font-bold">
                          PAY ON ARRIVAL
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>

                <div className="flex justify-between items-center border-t border-b border-gray-200 py-4 mb-4">
                  <div className="w-full text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Delivery</div>
                    <div className="font-bold text-[#1F3822]">{formData.date || 'Soon'}</div>
                  </div>
                </div>

                <p className="text-center text-xs text-gray-500 font-medium">Need help? Call +91 6304693028</p>

                <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 p-4 pb-8 z-[9999] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <button
                    onClick={handleConfirmOrder}
                    disabled={isSubmitting || (paymentMethod === 'upi' && !hasConfirmedPayment)}
                    className="w-full bg-[#D98310] text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:bg-amber-700 transition-colors uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? "PROCESSING..." : paymentMethod === 'upi' ? "I Have Completed the Payment" : "CONFIRM ORDER"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'booking' && step === 4 && (
            <motion.div
              key="step4" custom={direction} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
              className="px-6 pt-12 pb-32 relative z-0"
            >
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                  <ShieldCheck size={40} />
                </div>
                <h2 className="font-bold text-[#1F3822] text-3xl leading-tight mb-3">Order Confirmed!</h2>
                <p className="text-gray-500">Your marigolds are reserved. Order ID: <span className="font-bold text-[#1F3822]">{confirmedOrder?.order_code || confirmedOrder?.id || 'MG-1009'}</span></p>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100 mb-8">
                <div className="relative pl-6 py-2">
                  <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gray-200"></div>

                  <div className="relative mb-8">
                    <div className="absolute -left-6 top-1 w-6 h-6 bg-amber-600 rounded-full border-4 border-white flex items-center justify-center shadow-sm">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <h4 className="font-bold text-[#1F3822] text-lg mb-1">Order Placed</h4>
                    <p className="text-sm text-gray-500">We've received your request.</p>
                  </div>

                  <div className="relative mb-8">
                    <div className="absolute -left-6 top-1 w-6 h-6 bg-white rounded-full border-2 border-gray-300"></div>
                    <h4 className="font-bold text-gray-500 text-lg mb-1">Harvesting</h4>
                    <p className="text-sm text-gray-400">Fresh picking on {formData.date}</p>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-6 h-6 bg-white rounded-full border-2 border-gray-300"></div>
                    <h4 className="font-bold text-gray-500 text-lg mb-1">Out for Delivery</h4>
                    <p className="text-sm text-gray-400">On the way to your location.</p>
                  </div>
                </div>
              </div>
              <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 p-4 pb-8 z-[9999] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button
                  onClick={() => {
                    setStep(1);
                    setCurrentView('booking');
                    setCart({});
                    setFormData({
                      fullName: '',
                      phone: '',
                      date: '',
                      houseNumber: '',
                      streetName: '',
                      landmark: '',
                      coordinates: [17.5144, 78.6472],
                    });
                    setShowSuccessToast(true);
                    window.scrollTo(0, 0);
                  }}
                  className="w-full bg-[#1F3822] text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:bg-[#2c4d3b] transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} /> BACK TO HOME
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        <AnimatePresence>
          {showSuccessToast && (
            <motion.div
              initial={{ opacity: 0, y: 20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
              className="fixed bottom-10 left-1/2 bg-[#1F3822] text-[#FAFAF7] px-6 py-3 rounded-full shadow-2xl z-[9999] flex items-center space-x-4 border border-[#D98310]/30 whitespace-nowrap"
            >
              <span className="text-sm font-medium">Order placed successfully!</span>
              <div className="h-4 w-px bg-gray-500"></div>
              <button
                onClick={() => {
                  setShowSuccessToast(false);
                  setCurrentView('orders');
                }}
                className="text-[#D98310] text-sm font-bold hover:underline"
              >
                View My Orders
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
