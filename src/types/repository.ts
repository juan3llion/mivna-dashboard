export interface Repository {
  id: string;
  github_repo_id: number | null;
  name: string;
  file_tree: { path: string; type: string }[] | null;
  diagram_code: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  description?: string | null;
  url?: string | null;
}
