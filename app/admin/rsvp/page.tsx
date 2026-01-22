import { createServiceClient, getRsvpList, getRsvpSummary } from "../../lib/admin-rsvp";

export const dynamic = "force-dynamic";

export default async function AdminRsvpPage() {
  const supabase = createServiceClient();
  const [summary, recent] = await Promise.all([
    getRsvpSummary(supabase),
    getRsvpList(supabase, 50, 0),
  ]);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: "32px" }}>
      <h1>RSVP Admin Dashboard</h1>
      <section style={{ marginTop: "24px" }}>
        <h2>Totals</h2>
        <ul>
          <li>Total RSVPs: {summary.total}</li>
          <li>Attending: {summary.attending}</li>
          <li>Not attending: {summary.notAttending}</li>
          <li>Last 7 days: {summary.last7Days}</li>
          <li>Last 30 days: {summary.last30Days}</li>
        </ul>
      </section>

      <section style={{ marginTop: "24px" }}>
        <h2>Recent RSVPs</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Name</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Attending</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: "8px 0" }}>{row.Name}</td>
                <td style={{ padding: "8px 0" }}>
                  {row.attending === null ? "—" : row.attending ? "Yes" : "No"}
                </td>
                <td style={{ padding: "8px 0" }}>
                  {new Date(row.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: "24px" }}>
        <a href="/api/admin/rsvp/export.csv">Download CSV</a>
      </section>
    </main>
  );
}
