export const ERROR_MAP: { [code: number]: { name: string; msg: string } } = {
  6000: { name: 'NoAutorizado', msg: 'No estás autorizado para realizar esta acción.' },
  6001: { name: 'NoEsPropietario', msg: 'No eres el propietario de este certificado.' },
  6002: { name: 'CertificadoInactivo', msg: 'El certificado está inactivo o suspendido.' },
  6003: { name: 'CertificadoRevocado', msg: 'El certificado ha sido revocado permanentemente.' },
  6004: { name: 'CertificadoEnVenta', msg: 'El certificado ya se encuentra en venta.' },
  6005: { name: 'NoEnVenta', msg: 'El certificado no está en venta.' },
  6006: { name: 'PrecioInvalido', msg: 'El precio ingresado es inválido.' },
  6007: { name: 'PropietarioInvalido', msg: 'El propietario indicado no coincide.' },
  6008: { name: 'RegistroInactivo', msg: 'El registro global está inactivo.' },
  6009: { name: 'TasaInvalida', msg: 'La tasa de plataforma debe estar entre 0 y 10000 bps.' },
  6010: { name: 'TextoDemasiadoLargo', msg: 'El texto proporcionado excede la longitud máxima permitida.' },
  6011: { name: 'Overflow', msg: 'Ocurrió un desbordamiento aritmético.' },
};

export function getErrorMessageFromCode(code: number): string | null {
  const entry = ERROR_MAP[code];
  return entry ? `${entry.name}: ${entry.msg}` : null;
}

export default ERROR_MAP;
