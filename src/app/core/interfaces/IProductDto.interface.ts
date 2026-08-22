import { IBrandDto, ICollectionDto, IDivisionDto, IFitDto, IProductTypeDto, IColorDto, ISizeDto } from "./IBaseCatalogDto.interface";

export interface IProductDto {
  id: string;
  sku: string;
  parent: string;
  styleName: string;
  isActive: boolean;

  brand: IBrandDto | string;
  division: IDivisionDto | string;
  type: IProductTypeDto | string;
  collection: ICollectionDto | string;
  fit?: IFitDto | string;
  color?: IColorDto | string;
  size?: ISizeDto | string;
  isLocal?: boolean;
}