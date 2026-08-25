import pinataSDK from '@pinata/sdk';
import fs from 'fs';

function getPinataClient() {
  const jwt = process.env.PINATA_JWT;
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_API_KEY;

  if (!jwt && !apiKey) return null;

  try {
    return new pinataSDK({
      pinataJWTKey: jwt || undefined,
      pinataApiKey: apiKey || undefined,
      pinataSecretApiKey: secretKey || undefined,
    });
  } catch (err) {
    console.warn('Advertencia al inicializar SDK de Pinata:', err.message);
    return null;
  }
}

export function isPinataConfigured() {
  return Boolean(process.env.PINATA_JWT || (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_API_KEY));
}

/**
 * Detecta el tipo MIME y la extensión adecuada basándose en el nombre de archivo o en los magic bytes del Buffer
 */
export function getMimeTypeAndExt(fileNameOrPath, fileBuffer = null) {
  let ext = '';
  if (fileNameOrPath && typeof fileNameOrPath === 'string') {
    const match = fileNameOrPath.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (match) ext = match[1].toLowerCase();
  }

  if (fileBuffer && Buffer.isBuffer(fileBuffer) && fileBuffer.length >= 4) {
    if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8 && fileBuffer[2] === 0xFF) {
      return { mimeType: 'image/jpeg', ext: 'jpg' };
    }
    if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
      return { mimeType: 'image/png', ext: 'png' };
    }
    if (fileBuffer.length >= 6 && (fileBuffer.toString('ascii', 0, 6) === 'GIF87a' || fileBuffer.toString('ascii', 0, 6) === 'GIF89a')) {
      return { mimeType: 'image/gif', ext: 'gif' };
    }
    if (fileBuffer.length >= 12 && fileBuffer.toString('ascii', 0, 4) === 'RIFF' && fileBuffer.toString('ascii', 8, 12) === 'WEBP') {
      return { mimeType: 'image/webp', ext: 'webp' };
    }
    if (fileBuffer.length >= 4 && fileBuffer.toString('utf8', 0, 100).includes('<svg')) {
      return { mimeType: 'image/svg+xml', ext: 'svg' };
    }
  }

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return { mimeType: 'image/jpeg', ext: 'jpg' };
    case 'webp':
      return { mimeType: 'image/webp', ext: 'webp' };
    case 'gif':
      return { mimeType: 'image/gif', ext: 'gif' };
    case 'svg':
      return { mimeType: 'image/svg+xml', ext: 'svg' };
    case 'bmp':
      return { mimeType: 'image/bmp', ext: 'bmp' };
    case 'avif':
      return { mimeType: 'image/avif', ext: 'avif' };
    case 'png':
    default:
      return { mimeType: 'image/png', ext: ext || 'png' };
  }
}

/**
 * Subir imagen física alojada en /uploads o Buffer a Pinata IPFS
 */
export async function uploadImageToIPFS(filePath, fileName) {
  if (!isPinataConfigured()) {
    console.warn('Pinata no está configurado. Omitiendo subida a IPFS.');
    return null;
  }

  let fileBuffer;
  if (typeof filePath === 'string' && fs.existsSync(filePath)) {
    try {
      fileBuffer = await fs.promises.readFile(filePath);
    } catch (e) {
      // ignore
    }
  } else if (Buffer.isBuffer(filePath)) {
    fileBuffer = filePath;
  }

  const { mimeType, ext } = getMimeTypeAndExt(fileName || (typeof filePath === 'string' ? filePath : ''), fileBuffer);
  const name = fileName || `image-${Date.now()}.${ext}`;

  // Intento 1: Usando SDK de Pinata
  const pinata = getPinataClient();
  if (pinata && typeof filePath === 'string' && fs.existsSync(filePath)) {
    try {
      const readableStreamForFile = fs.createReadStream(filePath);
      const options = { pinataMetadata: { name } };
      const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
      console.log(`Imagen subida a Pinata IPFS exitosamente: Hash=${result.IpfsHash}`);
      return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
    } catch (sdkErr) {
      console.warn('Error con SDK de Pinata para imagen, intentando REST API:', sdkErr.message);
    }
  }

  // Intento 2: Usando REST API de Pinata con FormData
  try {
    const jwt = process.env.PINATA_JWT;
    const apiKey = process.env.PINATA_API_KEY;
    const secretKey = process.env.PINATA_SECRET_API_KEY;

    if (!fileBuffer) {
      throw new Error('Archivo de imagen no válido para subir a Pinata');
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, name);
    formData.append('pinataMetadata', JSON.stringify({ name }));

    const headers = {};
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`;
    } else if (apiKey && secretKey) {
      headers['pinata_api_key'] = apiKey;
      headers['pinata_secret_api_key'] = secretKey;
    }

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`Imagen subida a Pinata REST API exitosamente: Hash=${data.IpfsHash}`);
      return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
    } else {
      const errText = await res.text();
      throw new Error(`Pinata REST API HTTP ${res.status}: ${errText}`);
    }
  } catch (error) {
    console.error('Error al subir imagen a Pinata IPFS:', error.message);
    return null;
  }
}

/**
 * Subir metadatos JSON del cNFT a Pinata IPFS
 */
export async function uploadMetadataToIPFS(metadataJSON, certId) {
  if (!isPinataConfigured()) {
    console.warn('Pinata no está configurado. Omitiendo subida de metadatos JSON a IPFS.');
    return null;
  }

  const jsonName = `certchain-metadata-${certId || Date.now()}.json`;

  // Intento 1: Usando REST API directa de Pinata
  try {
    const jwt = process.env.PINATA_JWT;
    const apiKey = process.env.PINATA_API_KEY;
    const secretKey = process.env.PINATA_SECRET_API_KEY;

    const headers = { 'Content-Type': 'application/json' };
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`;
    } else if (apiKey && secretKey) {
      headers['pinata_api_key'] = apiKey;
      headers['pinata_secret_api_key'] = secretKey;
    }

    const body = {
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: { name: jsonName },
      pinataContent: metadataJSON,
    };

    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`Metadatos JSON subidos a Pinata IPFS exitosamente: Hash=${data.IpfsHash}`);
      return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
    } else {
      const errText = await res.text();
      console.warn(`Pinata REST API pinJSON falló (HTTP ${res.status}): ${errText}, intentando SDK...`);
    }
  } catch (err) {
    console.warn('Error en REST API de Pinata para JSON, intentando SDK:', err.message);
  }

  // Intento 2: Usando SDK de Pinata
  const pinata = getPinataClient();
  if (pinata) {
    try {
      const options = { pinataMetadata: { name: jsonName } };
      const result = await pinata.pinJSONToIPFS(metadataJSON, options);
      console.log(`Metadatos JSON subidos via SDK a Pinata IPFS: Hash=${result.IpfsHash}`);
      return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
    } catch (error) {
      console.error('Error al subir metadatos JSON a Pinata via SDK:', error.message);
    }
  }

  return null;
}