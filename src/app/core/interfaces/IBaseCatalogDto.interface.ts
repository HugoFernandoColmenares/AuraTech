// Definición para Brand, Division, Type, Collection y Fit
export interface IBaseCatalogDto {
  id: string; // GUID/UUID
  name: string;
  isActive: boolean;
}

export interface IBrandDto extends IBaseCatalogDto { }
export interface IColorDto extends IBaseCatalogDto { }
export interface IDivisionDto extends IBaseCatalogDto { }
export interface IProductTypeDto extends IBaseCatalogDto { }
export interface ICollectionDto extends IBaseCatalogDto { }
export interface ISizeDto extends IBaseCatalogDto { }
export interface IFitDto extends IBaseCatalogDto { }