export interface Subcategory {
  id: string;
  name: string;
  name_da: string;
}

export interface Category {
  id: string;
  name: string;
  name_da: string;
  subcategories: Subcategory[];
}
