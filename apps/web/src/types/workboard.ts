export type WorkboardTask = {
  id: string;
  number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  owner: string;
  tags: string;
  source: string;
  parentId?: string | null;
};

export type WorkboardTaskCreate = {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  tags?: string;
  source?: string;
};
