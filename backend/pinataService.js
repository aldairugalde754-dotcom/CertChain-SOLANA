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
 * Subir imagen física alojada en /uploads o Buffer a Pinata IPFS
 */
export async function uploadImageToIPFS(filePath, fileName) {
  if (!isPinataConfigured()) {
    console.warn('Pinata no está configurado. Omitiendo subida a IPFS.');
    return null;
  }

  const name = fileName || `image-${Date.now()}.png`;

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

    let fileBuffer;
    if (typeof filePath === 'string' && fs.existsSync(filePath)) {
      fileBuffer = await fs.promises.readFile(filePath);
    } else if (Buffer.isBuffer(filePath)) {
      fileBuffer = filePath;
    } else {
      throw new Error('Archivo de imagen no válido para subir a Pinata');
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'image/png' });
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