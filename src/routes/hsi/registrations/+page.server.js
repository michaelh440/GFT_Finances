// src/routes/hsi/registrations/+page.server.js
import sql from '$lib/db';

export const load = async () => {
  try {
    // Get all distinct student+class+year combos for client-side funnel filtering
    const allRegistrations = await sql`
      SELECT DISTINCT
        r.student_id,
        r.class_code,
        EXTRACT(YEAR FROM r.registration_date)::INTEGER AS reg_year
      FROM registrations r
      WHERE r.class_code IN ('CT1', 'CT2', 'CT3', 'AGT1')
      ORDER BY r.student_id, r.class_code
    `;

    // Get available years
    const years = await sql`
      SELECT DISTINCT EXTRACT(YEAR FROM registration_date)::INTEGER AS year
      FROM registrations
      WHERE class_code IN ('CT1', 'CT2', 'CT3', 'AGT1')
      ORDER BY year ASC
    `;

    // Monthly breakdown for monthly charts
    const monthlyFunnel = await sql`
      WITH student_classes AS (
        SELECT DISTINCT student_id, class_code
        FROM registrations
        WHERE class_code IN ('CT1', 'CT2', 'CT3', 'AGT1')
      ),
      ct2_students AS (SELECT student_id FROM student_classes WHERE class_code = 'CT2'),
      ct3_students AS (SELECT student_id FROM student_classes WHERE class_code = 'CT3'),
      agt1_students AS (SELECT student_id FROM student_classes WHERE class_code = 'AGT1'),
      earliest_reg AS (
        SELECT student_id, class_code, MIN(registration_date) AS first_reg_date
        FROM registrations
        WHERE class_code IN ('CT1', 'CT2', 'CT3')
        GROUP BY student_id, class_code
      )
      SELECT
        DATE_TRUNC('month', er.first_reg_date)::DATE AS reg_month,
        er.class_code,
        COUNT(*) AS total_students,
        COUNT(*) FILTER (WHERE
          (er.class_code = 'CT1' AND er.student_id NOT IN (SELECT student_id FROM ct2_students))
          OR (er.class_code = 'CT2' AND er.student_id NOT IN (SELECT student_id FROM ct3_students))
          OR (er.class_code = 'CT3' AND er.student_id NOT IN (SELECT student_id FROM agt1_students))
        ) AS did_not_continue,
        COUNT(*) FILTER (WHERE
          (er.class_code = 'CT1' AND er.student_id IN (SELECT student_id FROM ct2_students))
          OR (er.class_code = 'CT2' AND er.student_id IN (SELECT student_id FROM ct3_students))
          OR (er.class_code = 'CT3' AND er.student_id IN (SELECT student_id FROM agt1_students))
        ) AS continued
      FROM earliest_reg er
      GROUP BY DATE_TRUNC('month', er.first_reg_date), er.class_code
      ORDER BY reg_month ASC, er.class_code ASC
    `;

    return {
      registrations: allRegistrations.map(r => ({
        student_id: r.student_id,
        class_code: r.class_code,
        reg_year: Number(r.reg_year)
      })),
      years: years.map(y => Number(y.year)),
      monthlyFunnel: monthlyFunnel.map(r => ({
        reg_month: r.reg_month.toISOString().split('T')[0],
        class_code: r.class_code,
        total_students: Number(r.total_students),
        did_not_continue: Number(r.did_not_continue),
        continued: Number(r.continued)
      }))
    };
  } catch (error) {
    console.error('Error loading registration funnel data:', error);
    return {
      registrations: [],
      years: [],
      monthlyFunnel: []
    };
  }
};