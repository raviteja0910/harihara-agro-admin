"use client"

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  MapPin,
  TrendingUp,
  Package,
  Truck,
  Edit2,
  X,
  LogOut,
  RefreshCw
} from 'lucide-react'

type OrderItem = {
  name: string
  quantity_kg?: number
  quantity?: number
  price?: number
}

type Order = {
  id: string | number
  orderCode: string
  createdAt: string
  customerName: string
  customerEmail?: string
  contact: string
  items: OrderItem[]
  totalAmount: number
  paymentStatus: string
  paymentMethod: string
  orderStatus: string
  deliveryDate?: string
  deliveryLat?: number
  deliveryLng?: number
}

type ProductStock = {
  id: string | number
  name: string
  totalAllocated: number
  price: number
}

const INITIAL_STOCK: ProductStock[] = [
  { id: 'deep-gold-double', name: 'Deep Gold Double', totalAllocated: 300, price: 95 },
  { id: 'bright-orange', name: 'Bright Orange', totalAllocated: 100, price: 80 },
  { id: 'yellow-marigold', name: 'Yellow Marigold', totalAllocated: 100, price: 95 },
]

const ORDER_STATUS_OPTIONS = [
  'Order Reserved',
  'Order Confirmed',
  'Harvested',
  'Out for Delivery',
  'Delivered',
  'Cancelled'
]

export default function AdminDashboard() {
  const [inventory, setInventory] = useState<ProductStock[]>(INITIAL_STOCK)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductStock | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true })

      if (error || !data || data.length === 0) {
        if (error) {
          console.error("Error fetching products:", error)
        }
        setInventory(INITIAL_STOCK)
      } else {
        const mapped: ProductStock[] = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          totalAllocated: Number(
            item.total_allocated !== undefined 
              ? item.total_allocated 
              : (item.totalAllocated !== undefined ? item.totalAllocated : 0)
          ),
          price: Number(item.price ?? 0)
        }))
        setInventory(mapped)
      }
    } catch (err) {
      console.error("Failed to fetch products:", err)
      setInventory(INITIAL_STOCK)
    }
  }

  const fetchOrders = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (ordersError) {
        console.error("Error fetching orders:", ordersError)
        setOrders([])
      } else if (ordersData) {
        const formattedOrders: Order[] = ordersData.map((order: any) => {
          let parsedItems: OrderItem[] = []
          const rawItems = order.items ?? order.order_items
          if (Array.isArray(rawItems)) {
            parsedItems = rawItems
          } else if (typeof rawItems === 'string') {
            try {
              parsedItems = JSON.parse(rawItems)
            } catch (e) {
              parsedItems = []
            }
          }

          const orderCode = order.order_code || (String(order.id).startsWith('MG-') ? String(order.id) : `MG-${order.id}`)

          return {
            id: order.id,
            orderCode: orderCode,
            createdAt: order.created_at 
              ? new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) 
              : '',
            customerName: order.customer_name || 'N/A',
            customerEmail: order.customer_email || order.user_email || 'No email provided',
            contact: order.contact || order.customer_phone || '',
            items: parsedItems,
            totalAmount: Number(order.total_amount || 0),
            paymentStatus: order.payment_status || 'pending',
            paymentMethod: order.payment_method || 'UPI',
            orderStatus: order.order_status || 'Order Reserved',
            deliveryDate: order.delivery_date,
            deliveryLat: order.delivery_lat,
            deliveryLng: order.delivery_lng
          }
        })
        setOrders(formattedOrders)
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    setIsRefreshing(true)
    await Promise.all([fetchProducts(), fetchOrders()])
    setIsRefreshing(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const updateOrderStatus = async (orderId: string | number, newStatus: string) => {
    // Update local UI state
    setOrders(orders.map(o => o.id === orderId ? { ...o, orderStatus: newStatus } : o))

    // Update Supabase database
    const { error } = await supabase
      .from('orders')
      .update({ order_status: newStatus })
      .eq('id', orderId)

    if (error) console.error("Error updating status:", error.message)
  }

  const handleSaveStock = async () => {
    if (!editingProduct) return

    const updatedAllocated = Number(editingProduct.totalAllocated) || 0
    const updatedPrice = Number(editingProduct.price) || 0

    // Optimistic UI update
    setInventory(prev => prev.map(p => 
      p.id === editingProduct.id 
        ? { ...p, totalAllocated: updatedAllocated, price: updatedPrice }
        : p
    ))
    setIsEditing(false)

    // Supabase update
    try {
      const { error } = await supabaseAdmin
        .from('products')
        .update({
          total_allocated: updatedAllocated,
          price: updatedPrice
        })
        .eq('id', editingProduct.id)

      if (error) {
        console.error("Failed to update product in Supabase:", error)
      }
    } catch (err) {
      console.error("Error saving stock in Supabase:", err)
    } finally {
      setEditingProduct(null)
    }
  }

  // Calculated Metrics
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, order) => {
    if (order.paymentStatus?.toLowerCase() === 'completed') {
      return sum + Number(order.totalAmount || 0)
    }
    return sum
  }, 0)

  const pendingDeliveries = orders.filter(o => 
    o.orderStatus !== 'Delivered' && o.orderStatus !== 'Cancelled'
  ).length

  // Calculate live available stock
  const liveStockData = inventory.map(product => {
    let quantitySold = 0
    orders.forEach(order => {
      if (order.orderStatus?.toLowerCase() === 'cancelled') return
      if (order.items && Array.isArray(order.items)) {
        const item = order.items.find((i: any) => 
          i.name?.trim().toLowerCase() === product.name.trim().toLowerCase() ||
          i.id === product.id
        )
        if (item) {
          quantitySold += Number(item.quantity_kg !== undefined ? item.quantity_kg : (item.quantity || 0))
        }
      }
    })
    return {
      ...product,
      quantitySold,
      availableStock: Math.max(0, product.totalAllocated - quantitySold)
    }
  })

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-sans">
      {/* Top Navigation */}
      <nav className="bg-[#1F3822] text-white px-6 sm:px-8 py-3 shadow-md sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center space-x-3.5">
          <Image
            src="/icon.png"
            alt="Harihara Agro Logo"
            width={45}
            height={45}
            className="object-contain rounded-lg"
            priority
          />
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-wide leading-tight">Harihara Agro Dashboard</h1>
            <p className="text-xs text-green-300/80 hidden sm:block">Farm Inventory & Order Operations</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4 text-sm font-medium">
          <button
            onClick={loadData}
            title="Refresh Data"
            disabled={isRefreshing}
            className="p-2 text-green-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="hidden sm:flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs text-gray-200 font-medium">Live Connected</span>
          </div>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/'
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500/20 text-red-200 hover:bg-red-500 hover:text-white border border-red-500/30 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>LOG OUT</span>
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Top Row: Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard 
            title="Total Revenue" 
            value={`₹${totalRevenue.toLocaleString('en-IN')}`} 
            icon={<TrendingUp className="text-green-600 h-6 w-6" />} 
          />
          <MetricCard 
            title="Total Orders" 
            value={totalOrders} 
            icon={<Package className="text-blue-600 h-6 w-6" />} 
          />
          <MetricCard 
            title="Pending Deliveries" 
            value={pendingDeliveries} 
            icon={<Truck className="text-amber-600 h-6 w-6" />} 
          />
        </div>

        {/* Second Row: Live Inventory */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Package className="mr-2 h-5 w-5 text-[#1F3822]" /> Live Inventory
            </h2>
            <span className="text-xs text-gray-500 font-medium bg-white px-3 py-1 rounded-full border border-gray-200 shadow-xs">
              Marigold Flower Catalog
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {liveStockData.map(product => (
              <div 
                key={product.id} 
                className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden hover:shadow-md transition-all duration-200"
              >
                <div className="p-5 sm:p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight">{product.name}</h3>
                      <span className="inline-block mt-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                        Marigold
                      </span>
                    </div>
                    <button 
                      onClick={() => { 
                        setEditingProduct(product)
                        setIsEditing(true) 
                      }}
                      title="Edit Stock & Price"
                      className="p-2 text-gray-400 hover:text-[#1F3822] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Total Allocated:</span>
                      <span className="font-bold text-gray-900">{product.totalAllocated} kg</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Available Stock:</span>
                      <span className={`font-bold ${product.availableStock < 20 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {product.availableStock} kg
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Current Price:</span>
                      <span className="font-extrabold text-[#1F3822] text-base">
                        ₹{product.price}/kg
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/80 px-5 sm:px-6 py-3 border-t border-gray-100">
                  <div className="w-full">
                    <div className="flex justify-between mb-1.5 text-xs font-medium text-gray-600">
                      <span>Available Capacity</span>
                      <span className="font-semibold text-gray-800">
                        {Math.round(Math.min(100, Math.max(0, (product.availableStock / (product.totalAllocated || 1)) * 100)))}% Left
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-[#1F3822] h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, Math.max(0, (product.availableStock / (product.totalAllocated || 1)) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Activity Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-white">
            <h2 className="text-xl font-bold text-gray-900">Recent Orders</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="px-6 py-4 font-semibold">ORDER INFO</th>
                  <th className="px-6 py-4 font-semibold">CUSTOMER</th>
                  <th className="px-6 py-4 font-semibold">ITEMS</th>
                  <th className="px-6 py-4 font-semibold">TOTAL AMOUNT</th>
                  <th className="px-6 py-4 font-semibold">PAYMENT STATUS</th>
                  <th className="px-6 py-4 font-semibold">ORDER STATUS</th>
                  <th className="px-6 py-4 font-semibold text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Order Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900">{order.orderCode}</span>
                          <span className="text-sm text-gray-500">{order.createdAt}</span>
                          {order.deliveryDate && (
                            <span className="text-sm text-green-600 font-medium mt-1">
                              Delivery: {order.deliveryDate}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900">{order.customerName}</span>
                          <span className="text-sm text-gray-500">{order.customerEmail}</span>
                          {order.contact && (
                            <span className="text-xs text-gray-400 mt-0.5">{order.contact}</span>
                          )}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item, idx) => (
                              <span 
                                key={idx} 
                                className="inline-block text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200/70 px-2.5 py-1 rounded-full whitespace-nowrap"
                              >
                                {item.quantity_kg !== undefined ? item.quantity_kg : (item.quantity ?? 1)} kg x {item.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">No items</span>
                          )}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                        ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Payment Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${
                              order.paymentStatus?.toLowerCase() === 'completed'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                            }`}
                          >
                            {order.paymentStatus ? (order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)) : 'Pending'}
                          </span>
                          {order.paymentMethod && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                              {order.paymentMethod}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Order Status Dropdown */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          className="text-xs font-medium rounded-lg px-3 py-1.5 border border-gray-300 bg-white text-gray-700 shadow-xs focus:border-[#1F3822] focus:ring-1 focus:ring-[#1F3822] outline-none cursor-pointer"
                          value={order.orderStatus}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        >
                          {ORDER_STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>

                      {/* Actions: Dark Green Map Button */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {order.deliveryLat && order.deliveryLng ? (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${order.deliveryLat},${order.deliveryLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1F3822] text-white text-xs font-medium rounded-lg hover:bg-[#2c4c30] transition-colors shadow-xs"
                          >
                            <MapPin className="h-3.5 w-3.5" /> Map
                          </a>
                        ) : (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerName + ' Hyderabad')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1F3822] text-white text-xs font-medium rounded-lg hover:bg-[#2c4c30] transition-colors shadow-xs"
                          >
                            <MapPin className="h-3.5 w-3.5" /> Map
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit Stock & Price Modal */}
      {isEditing && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Edit Stock & Pricing</h3>
                <p className="text-xs text-gray-500">{editingProduct.name}</p>
              </div>
              <button 
                onClick={() => { setIsEditing(false); setEditingProduct(null); }} 
                className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-medium cursor-not-allowed text-sm">
                  {editingProduct.name}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Allocated Stock (kg)</label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  value={editingProduct.totalAllocated}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct, 
                    totalAllocated: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F3822] focus:border-[#1F3822] outline-none transition-shadow text-gray-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per kg (₹)</label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct, 
                    price: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F3822] focus:border-[#1F3822] outline-none transition-shadow text-gray-900 font-medium"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
              <button 
                type="button"
                onClick={() => { setIsEditing(false); setEditingProduct(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSaveStock}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1F3822] rounded-lg hover:bg-[#2c4c30] transition-colors shadow-sm cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center hover:shadow-md transition-shadow">
      <div className="h-14 w-14 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 mr-5">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  )
}
