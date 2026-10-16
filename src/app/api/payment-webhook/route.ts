import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { amount, utr } = body;

    if (amount === undefined || utr === undefined) {
      return NextResponse.json(
        { error: 'Missing amount or utr in request body' },
        { status: 400 }
      );
    }

    // Query the orders table to find the oldest order where payment_status is 'pending' 
    // and the total_amount matches the incoming amount.
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_status', 'pending')
      .eq('total_amount', amount)
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching orders:', fetchError);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { message: 'No matching pending order found' },
        { status: 404 }
      );
    }

    const matchingOrder = orders[0];

    // Update the matching order's payment_status to 'completed' and store the utr
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'completed',
        utr: utr
      })
      .eq('id', matchingOrder.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Payment verified successfully', order_id: matchingOrder.id },
      { status: 200 }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Bad Request' },
      { status: 400 }
    );
  }
}
