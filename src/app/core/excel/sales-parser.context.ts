import { IReferenceSheetDto } from '@core/interfaces/IReferenceSheetDto.interface';

export interface SalesParserContext {
  referenceList: IReferenceSheetDto[];
}

export interface ParserValidationError {
  title: string;
  message: string;
}
