import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kxlckzvflqlnhvwevipo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bGNrenZmbHFsbmh2d2V2aXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTYzNzMsImV4cCI6MjA4ODA3MjM3M30.c9ri84mJ5uZ6lS2_0A0_B5ljn7KMO8cAuUbIcCnIQ84'

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const { data: pedidos } = await supabase.from('pedidos').select('id, numero_pedido, status').eq('numero_pedido', 'PED-515691')
    console.log('Pedido PED-515691:', pedidos)

    const { data: expedicoes } = await supabase.from('expedicao').select('id, numero_pedido, status').ilike('numero_pedido', '%515691%')
    console.log('Expedicoes para 515691:', expedicoes)
}
run()
