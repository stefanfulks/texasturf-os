-- Restrict invoice "approved" and "paid" transitions to admin role.
--
-- Audit finding: the previous "invoices: update admin/office" policy let any
-- office user set status='approved' or 'paid' directly via the Supabase JS
-- client or a hand-crafted POST to the server action. The approval page only
-- gated at the UI layer. This migration adds a WITH CHECK so the database
-- itself rejects office-role writes that move an invoice into the money-
-- releasing statuses.
--
-- Office can still drive the rest of the workflow (awaiting_review,
-- awaiting_approval, request_change, rejected, on_hold) and edit draft
-- invoices. Admin retains full control.

DROP POLICY IF EXISTS "invoices: update admin/office" ON invoices;

CREATE POLICY "invoices: update admin/office" ON invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'office')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'office')
    )
    AND (
      status NOT IN ('approved', 'paid')
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );
