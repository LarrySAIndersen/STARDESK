export interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  scan_status: string;
  scan_status_label_da: string;
  scanned_at: string | null;
  created_at: string;
  download_available: boolean;
}
