export interface ICreditCardTransactionDto {
  id?: string;                    // GUID/UUID opcional para persistencia en SQLite
  date: Date;                     // 'Date' -> Convertido de 'MM/DD/YYYY'
  receipt: string | null;         // 'Receipt' -> Viene vacío en el ejemplo
  description: string;            // 'Description' -> Nombre comercial (ej: GOOGLE *ADS)
  cardMember: string;             // 'Card Member' -> Nombre del portador (ej: MARIA F CRISTANCHO)
  accountNumberSuffix: string;    // 'Account #' -> Los últimos dígitos (ej: -42104)
  amount: number;                 // 'Amount' -> El monto monetario. Ej: 237.18 (limpiando comas de decimales)
  extendedDetails: string;        // 'Extended Details' -> Bloque de texto extra descriptivo
  statementDescription: string;   // 'Appears On Your Statement As' -> Texto exacto del banco
  
  // Datos de Ubicación / Comercio
  address: string;                // 'Address'
  cityState: string;              // 'City/State' -> Contiene ciudad y departamento/estado
  zipCode: string;                // 'Zip Code'
  country: string;                // 'Country'
  
  // Auditoría e Identificación Bancaria
  referenceNumber: string;        // 'Reference' -> El ID único que asigna el banco a la transacción
  category: string;               // 'Category' -> Clasificación del gasto (ej: Business Services-Advertising)

  // Enriched fields from mapping sheets
  channel?: string;               // From CHANNEL_CARD_REPORT_DATA (channels)
  salesChannel?: string;         // From MAP_SHEET_DATA (salesChannel)
  dept?: string;                 // From MAP_SHEET_DATA (dept)
  control?: string;              // From MAP_SHEET_DATA or CHANNEL_CARD_REPORT_DATA (control)
  auditMonth?: number | string;
  auditYear?: number | string;
  isLocal?: boolean;
}