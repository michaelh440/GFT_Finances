// src/routes/hsi/reports/+page.server.js
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
        track
      FROM classes
      WHERE is_active = true
      ORDER BY track ASC, class_name ASC
    `;
    
    // Get all monthly summaries with class info
    const summaries = await sql`
      SELECT 
        mcs.class_code,
        mcs.summary_month,
        mcs.summary_year,
        mcs.registrations,
        mcs.revenue,
        c.class_name,
        c.track
      FROM monthly_class_summary mcs
      JOIN classes c ON mcs.class_code = c.class_code
      ORDER BY mcs.summary_month ASC
    `;
    
    return {
      classes: classes.map(c => ({
        ...c,
        standard_price: Number(c.standard_price)
      })),
      summaries: summaries.map(s => ({
        ...s,
        summary_month: s.summary_month.toISOString().split('T')[0],
        summary_year: Number(s.summary_year),
        registrations: Number(s.registrations),
        revenue: Number(s.revenue)
      }))
    };
  } catch (error) {
    console.error('Error loading report data:', error);
    return {
      classes: [],
      summaries: []
    };
  }
};