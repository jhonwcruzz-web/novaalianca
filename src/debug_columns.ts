import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
    const { data, error } = await supabase.from('expedicao').select('*').limit(1)
    if (error) {
        console.error('Error fetching data:', error.message)
        return
    }
    if (data && data.length > 0) {
        console.log('Columns in expedicao:', Object.keys(data[0]))
    } else {
        // If no data, try to fetch with a specific column to see if it exists
        const { error: err2 } = await supabase.from('expedicao').select('comprador_id').limit(1)
        if (err2) {
            console.log('comprador_id column likely does NOT exist.')
        } else {
            console.log('comprador_id column EXISTS.')
        }
    }
}

checkColumns()
