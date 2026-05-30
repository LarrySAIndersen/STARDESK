export type PageLayoutFieldSpan = "full" | "half";

export type PageLayoutFieldConfig = {
  label: string;
  order: number;
  span: PageLayoutFieldSpan;
  collapsed: boolean;
};

export type PageLayoutPageConfig = {
  fields: Record<string, PageLayoutFieldConfig>;
};

export type PageLayoutFieldDefaults = {
  label: string;
  order: number;
  span?: PageLayoutFieldSpan;
};
