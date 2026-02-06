// src/routes/hsi/enter_monthly_summary/+page.server.js
import sql from '$lib/db';

export const load = async () => {
  try {
    // Get all active classes
    const classes = await sql`
      SELECT 
        class_code,
        class_name,
        class_type,
        student_type,
        standard_price,
        track,
        description,
        is_active
      FROM classes
      WHERE is_active = true
      ORDER BY track ASC, class_name ASC
    `;
    
    // Get all existing summaries (not filtered by month)
    const existingSummaries = await sql`
      SELECT 
        class_code,
        summary_month,
        summary_year,
        registrations,
        revenue
      FROM monthly_class_summary
      ORDER BY summary_month DESC, class_code
    `;
    
    return {
      classes: classes.map(c => ({
        ...c,
        standard_price: Number(c.standard_price)
      })),
      existingSummaries: existingSummaries.map(s => ({
        ...s,
        summary_month: s.summary_month.toISOString().split('T')[0],
        summary_year: Number(s.summary_year),
        registrations: Number(s.registrations),
        revenue: Number(s.revenue)
      }))
    };
  } catch (error) {
    console.error('Error loading data:', error);
    return {
      classes: [],
      existingSummaries: []
    };
  }
};

export const actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const entryCount = parseInt(String(formData.get('entry_count'))) || 0;

    if (entryCount === 0) {
      return {
        success: false,
        error: 'No entries to save'
      };
    }

    try {
      // Process each entry
      for (let i = 0; i < entryCount; i++) {
        const month = String(formData.get(`month_${i}`) || '');
        const classCode = String(formData.get(`class_code_${i}`) || '');
        const registrations = parseInt(String(formData.get(`registrations_${i}`))) || 0;
        const revenue = parseFloat(String(formData.get(`revenue_${i}`))) || 0;

        // Validate required fields
        if (!month || !classCode) {
          continue; // Skip invalid entries
        }

        // Convert month (YYYY-MM) to first day of month (YYYY-MM-01)
        const summaryMonth = month + '-01';
        const summaryYear = parseInt(month.split('-')[0]);
        
        // Insert or update the summary
        await sql`
          INSERT INTO monthly_class_summary (
            class_code,
            summary_month,
            summary_year,
            registrations,
            revenue,
            updated_at
          ) VALUES (
            ${classCode},
            ${summaryMonth},
            ${summaryYear},
            ${registrations},
            ${revenue},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (class_code, summary_month)
          DO UPDATE SET
            registrations = ${registrations},
            revenue = ${revenue},
            summary_year = ${summaryYear},
            updated_at = CURRENT_TIMESTAMP
        `;
      }
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Error saving monthly summaries:', error);
      return {
        success: false,
        error: 'Failed to save summaries. Please try again.'
      };
    }
  }
};