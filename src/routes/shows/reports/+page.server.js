// src/routes/shows/reports/+page.server.js
import sql from '$lib/db';

export const load = async () => {
  try {
    // Get all active shows
    const shows = await sql`
      SELECT 
        show_code,
        show_name,
        format,
        audience_type,
        day_of_week,
        standard_ticket_price
      FROM shows
      WHERE is_active = true
      ORDER BY format ASC, show_name ASC
    `;
    
    // Get all monthly summaries with show info
    const summaries = await sql`
      SELECT 
        mss.show_code,
        mss.summary_month,
        mss.summary_year,
        mss.tickets_sold,
        mss.revenue,
        s.show_name,
        s.format,
        s.audience_type,
        s.day_of_week
      FROM monthly_show_summary mss
      JOIN shows s ON mss.show_code = s.show_code
      ORDER BY mss.summary_month ASC
    `;
    
    return {
      shows: shows.map(s => ({
        ...s,
        standard_ticket_price: Number(s.standard_ticket_price || 0)
      })),
      summaries: summaries.map(s => ({
        ...s,
        summary_month: s.summary_month.toISOString().split('T')[0],
        summary_year: Number(s.summary_year),
        tickets_sold: Number(s.tickets_sold),
        revenue: Number(s.revenue)
      }))
    };
  } catch (error) {
    console.error('Error loading show report data:', error);
    return {
      shows: [],
      summaries: []
    };
  }
};