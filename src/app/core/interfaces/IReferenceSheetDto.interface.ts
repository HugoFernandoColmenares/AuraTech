export interface IReferenceSheetDto {
  id?: string;
  parent: string;
  styleName: string;
  brand: string;
  div: string;
  type: string;
  collection: string;
  fit: string;
  isLocal?: boolean;
}