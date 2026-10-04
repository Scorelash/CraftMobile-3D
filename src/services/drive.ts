import { getAccessToken } from './auth';

export interface DriveWorldFile {
  id: string;
  name: string;
  displayName: string;
  modifiedTime: string;
  size?: string;
  description?: string;
}

export interface SavedWorldData {
  version: number;
  name: string;
  savedAt: number;
  gameMode: 'creative' | 'survival';
  timeOfDay: number; // 0 to 1 (0: sunrise, 0.25: noon, 0.5: sunset, 0.75: midnight)
  playerPosition: [number, number, number];
  playerRotation: [number, number];
  blocks: { [key: string]: number }; // coordinate "x,y,z" -> blockId
  inventory: any[];
  selectedSlot: number;
  health?: number;
  hunger?: number;
}

/**
 * List all Minecraft world save files created in Google Drive
 */
export async function listDriveWorldFiles(): Promise<DriveWorldFile[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  const query = encodeURIComponent("name contains 'craftmobile_world_' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size,description)&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const files: DriveWorldFile[] = (data.files || []).map((f: any) => {
    // craftmobile_world_MyWorld.json -> MyWorld
    let displayName = f.name.replace(/^craftmobile_world_/, '').replace(/\.json$/, '');
    displayName = decodeURIComponent(displayName);
    return {
      id: f.id,
      name: f.name,
      displayName: displayName || 'Untitled World',
      modifiedTime: f.modifiedTime,
      size: f.size,
      description: f.description,
    };
  });

  return files;
}

/**
 * Save world data to Google Drive as a JSON file
 */
export async function saveWorldToDrive(
  worldName: string,
  worldData: SavedWorldData,
  existingFileId?: string
): Promise<{ id: string; name: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  const cleanName = encodeURIComponent(worldName.trim() || 'My_World');
  const fileName = `craftmobile_world_${cleanName}.json`;
  const fileContent = JSON.stringify(worldData, null, 2);

  if (existingFileId) {
    // Update existing file content & metadata
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: fileContent,
    });

    if (!res.ok) {
      throw new Error(`Failed to update world on Google Drive: ${await res.text()}`);
    }

    return { id: existingFileId, name: fileName };
  } else {
    // Create new file using multipart upload
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: `CraftMobile 3D World: ${worldName}`,
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelimiter;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to upload world to Google Drive: ${await res.text()}`);
    }

    const data = await res.json();
    return { id: data.id, name: data.name };
  }
}

/**
 * Load a saved Minecraft world from Google Drive
 */
export async function loadWorldFromDrive(fileId: string): Promise<SavedWorldData> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to download world save: ${await res.text()}`);
  }

  const data = await res.json();
  return data as SavedWorldData;
}

/**
 * Delete a world save from Google Drive (Must be preceded by user confirmation in UI)
 */
export async function deleteWorldFromDrive(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete world file: ${await res.text()}`);
  }
}
