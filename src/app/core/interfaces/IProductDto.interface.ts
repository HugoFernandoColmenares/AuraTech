export interface IProductDto {
  id: string;
  sku: string;
  parent: string;
  styleName: string;
  brand: string;
  type: string;
  collection: string;
  isActive: boolean;
  isLocal?: boolean;
}
