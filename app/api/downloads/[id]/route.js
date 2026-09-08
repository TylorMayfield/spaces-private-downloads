import { handleDownload } from '../../../../lib/server-downloads.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  return handleDownload(request, id);
}
