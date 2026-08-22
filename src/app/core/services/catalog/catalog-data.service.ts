import { Injectable, inject, computed } from '@angular/core';
import { BrandsApiService } from '@core/services/api/brands-api.service';
import { DivisionsApiService } from '@core/services/api/divisions-api.service';
import { CollectionsApiService } from '@core/services/api/collections-api.service';
import { ProductTypesApiService } from '@core/services/api/product-types-api.service';
import { FitsApiService } from '@core/services/api/fits-api.service';
import { SizesApiService } from '@core/services/api/sizes-api.service';
import { ColorsApiService } from '@core/services/api/colors-api.service';
import {
  IBrandDto,
  ICollectionDto,
  IDivisionDto,
  IFitDto,
  IProductTypeDto,
  ISizeDto,
  IColorDto,
} from '@core/interfaces/IBaseCatalogDto.interface';
import {
  resolveCatalogId,
  BRAND_IDS,
  DIVISION_IDS,
  COLLECTION_IDS,
  TYPE_IDS,
  FIT_IDS,
  SIZE_IDS,
  COLOR_IDS,
} from '@core/data/catalog-id-map';

/**
 * Read-through cache for catalog lookups (brands, divisions, collections).
 * Warmed once on app bootstrap; refreshed when catalog API services mutate data.
 */
@Injectable({ providedIn: 'root' })
export class CatalogDataService {
  private brandsApi = inject(BrandsApiService);
  private divisionsApi = inject(DivisionsApiService);
  private collectionsApi = inject(CollectionsApiService);
  private typesApi = inject(ProductTypesApiService);
  private fitsApi = inject(FitsApiService);
  private sizesApi = inject(SizesApiService);
  private colorsApi = inject(ColorsApiService);

  readonly brands = computed(() => this.brandsApi.cachedItems() as IBrandDto[]);
  readonly divisions = computed(() => this.divisionsApi.cachedItems() as IDivisionDto[]);
  readonly collections = computed(() => this.collectionsApi.cachedItems() as ICollectionDto[]);
  readonly types = computed(() => this.typesApi.cachedItems() as IProductTypeDto[]);
  readonly fits = computed(() => this.fitsApi.cachedItems() as IFitDto[]);
  readonly sizes = computed(() => this.sizesApi.cachedItems() as ISizeDto[]);
  readonly colors = computed(() => this.colorsApi.cachedItems() as IColorDto[]);

  resolveBrandId(name: string | undefined | null): string | null {
    return resolveCatalogId(BRAND_IDS, name);
  }

  resolveDivisionId(name: string | undefined | null): string | null {
    return resolveCatalogId(DIVISION_IDS, name);
  }

  resolveCollectionId(name: string | undefined | null): string | null {
    return resolveCatalogId(COLLECTION_IDS, name);
  }

  resolveTypeId(name: string | undefined | null): string | null {
    return resolveCatalogId(TYPE_IDS, name);
  }

  resolveFitId(name: string | undefined | null): string | null {
    return resolveCatalogId(FIT_IDS, name);
  }

  resolveSizeId(name: string | undefined | null): string | null {
    return resolveCatalogId(SIZE_IDS, name);
  }

  resolveColorId(name: string | undefined | null): string | null {
    return resolveCatalogId(COLOR_IDS, name);
  }

  async loadAll(): Promise<void> {
    await Promise.all([
      this.brandsApi.ensureListCache(),
      this.divisionsApi.ensureListCache(),
      this.collectionsApi.ensureListCache(),
      this.typesApi.ensureListCache(),
      this.fitsApi.ensureListCache(),
      this.sizesApi.ensureListCache(),
      this.colorsApi.ensureListCache(),
    ]);
  }
}
