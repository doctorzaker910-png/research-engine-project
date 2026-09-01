import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://ixylbdkzczeimrugppxs.supabase.co'
export const supabaseKey = 'sb_publishable_eSNBvUIG4R6U1Es8xnw_jQ_Z6O3KisR'
export const supabase = createClient(supabaseUrl, supabaseKey)
