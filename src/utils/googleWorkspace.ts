import { Issue } from '../types';

/**
 * Interface representing a Google Chat space
 */
export interface ChatSpace {
  name: string;
  displayName?: string;
  type?: string;
}

/**
 * 1. Exports a civic report to Google Docs inside a dedicated folder on Google Drive.
 * If the folder does not exist, it creates it.
 */
export async function exportToDocs(accessToken: string, issue: Issue): Promise<string> {
  const folderId = await getOrCreateDriveFolder(accessToken, 'Community Hero Cases');
  
  // Create a Google Doc directly inside the folder
  const createDocRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `Civic Case File: ${issue.title}`,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId]
    })
  });

  if (!createDocRes.ok) {
    const err = await createDocRes.text();
    console.error('Docs creation error details:', err);
    throw new Error('Failed to create document in Google Drive');
  }

  const docFile = await createDocRes.json();
  const documentId = docFile.id;

  // Insert structured content into the newly created Google Doc
  const content = `CIVIC GRIEVANCE PETITION & REPORT\n` +
                  `================================\n\n` +
                  `CASE TITLE: ${issue.title}\n` +
                  `CATEGORY: ${issue.category}\n` +
                  `SEVERITY: ${issue.severity}\n` +
                  `STATUS: ${issue.status || 'Active'}\n` +
                  `LOCATION: ${issue.address} (${issue.lat}, ${issue.lng})\n` +
                  `CASE TRUST SCORE: ${issue.trust_score || 50}%\n` +
                  `REPORT DATE: ${new Date(issue.createdAt).toLocaleString()}\n\n` +
                  `--------------------------------------------------\n` +
                  `CASE SUMMARY:\n` +
                  `${issue.summary}\n\n` +
                  `RECOMMENDED ACTION:\n` +
                  `${issue.recommended_action || 'Inspect the site and initiate community/municipal cleanup'}\n\n` +
                  `SAFETY WARNING:\n` +
                  `${issue.safety_warning || 'No critical hazard warnings specified. Exercise standard neighborhood caution.'}\n\n` +
                  `--------------------------------------------------\n` +
                  `Submitted securely via Community Hero Civic Sensor Network.\n` +
                  `Case reference ID: ${issue.id}\n`;

  const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            text: content,
            location: { index: 1 }
          }
        }
      ]
    })
  });

  if (!updateRes.ok) {
    throw new Error('Failed to write report details into Google Doc');
  }

  return `https://docs.google.com/document/d/${documentId}/edit`;
}

/**
 * 2. Appends the civic report to a master spreadsheet on Google Sheets.
 * Automatically creates the spreadsheet if it does not exist yet.
 */
export async function exportToSheets(accessToken: string, issue: Issue): Promise<string> {
  let spreadsheetId = localStorage.getItem('community_hero_spreadsheet_id');
  let isNew = false;

  if (!spreadsheetId) {
    // Create new Master Spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: 'Community Hero - Ward Master Database' }
      })
    });

    if (!createRes.ok) {
      throw new Error('Failed to create Master Google Sheet');
    }

    const sheetData = await createRes.json();
    spreadsheetId = sheetData.spreadsheetId;
    if (spreadsheetId) {
      localStorage.setItem('community_hero_spreadsheet_id', spreadsheetId);
      isNew = true;
    }
  }

  if (!spreadsheetId) {
    throw new Error('No valid spreadsheet identifier resolved');
  }

  // If new, append headers first
  if (isNew) {
    await appendSheetValues(accessToken, spreadsheetId, 'Sheet1!A1', [
      ['Title', 'Category', 'Severity', 'Address', 'Status', 'Trust Score (%)', 'Report Date', 'Coordinates']
    ]);
  }

  // Append issue details row
  const rowData = [
    issue.title,
    issue.category,
    issue.severity,
    issue.address,
    issue.status || 'Active',
    issue.trust_score || 50,
    new Date(issue.createdAt).toLocaleDateString(),
    `${issue.lat}, ${issue.lng}`
  ];

  await appendSheetValues(accessToken, spreadsheetId, 'Sheet1!A:H', [rowData]);
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

/**
 * Helper to append rows of data to a spreadsheet
 */
async function appendSheetValues(accessToken: string, spreadsheetId: string, range: string, values: any[][]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Sheets append error details:', err);
    throw new Error('Failed to append data rows to Google Sheet');
  }
}

/**
 * 3. Schedules a neighborhood/site inspection event in the user's Google Calendar.
 */
export async function scheduleOnCalendar(accessToken: string, issue: Issue): Promise<string> {
  const start = new Date();
  // Schedule for tomorrow at 10:00 AM local time
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 45 * 60 * 1000); // 45 minutes duration

  const eventPayload = {
    summary: `⚠️ Site Inspection: ${issue.title}`,
    location: issue.address,
    description: `Joint community audit for reported civic issue.\n` +
                 `Category: ${issue.category}\n` +
                 `Severity: ${issue.severity} (${issue.severity_reason || 'Verified by AI'})\n` +
                 `Trust rating: ${issue.trust_score || 50}%\n\n` +
                 `Status checklist and instructions:\n` +
                 `1. Meet at the reported coordinates: ${issue.lat}, ${issue.lng}\n` +
                 `2. Validate current hazard risk/barricades\n` +
                 `3. Document with photos and submit dual Before/After proof to verify fix.`,
    start: {
      dateTime: start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    reminders: {
      useDefault: true
    }
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventPayload)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Calendar error details:', errText);
    throw new Error('Failed to schedule event in Google Calendar');
  }

  const createdEvent = await res.json();
  return createdEvent.htmlLink || 'https://calendar.google.com';
}

/**
 * 4. Adds the reported community issue to the user's Google Tasks.
 */
export async function createTaskItem(accessToken: string, issue: Issue): Promise<void> {
  const taskPayload = {
    title: `Resolve issue: ${issue.title}`,
    notes: `Category: ${issue.category}\n` +
           `Location: ${issue.address}\n` +
           `Coordinates: ${issue.lat}, ${issue.lng}\n` +
           `Action advice: ${issue.recommended_action || 'Inspect the site and report to council'}\n\n` +
           `Filed via Community Hero.`,
    due: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // due in 3 days
  };

  const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskPayload)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Tasks error details:', errText);
    throw new Error('Failed to add item to Google Tasks list');
  }
}

/**
 * 5. Lists the user's Google Chat spaces that are readable.
 */
export async function listChatSpaces(accessToken: string): Promise<ChatSpace[]> {
  const res = await fetch('https://chat.googleapis.com/v1/spaces', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Chat list spaces error details:', errText);
    throw new Error('Failed to list Google Chat spaces');
  }

  const data = await res.json();
  return data.spaces || [];
}

/**
 * 6. Dispatches a hazard message warning to a Google Chat space.
 */
export async function postChatMessage(accessToken: string, spaceName: string, text: string): Promise<void> {
  const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Chat post message error details:', errText);
    throw new Error('Failed to dispatch alert to Google Chat space');
  }
}

/**
 * Helper to get or create a folder on Google Drive
 */
async function getOrCreateDriveFolder(accessToken: string, folderName: string): Promise<string> {
  // Search for the folder first
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  // If not found, create a new one
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error('Folder creation error details:', err);
    throw new Error(`Failed to create Google Drive folder: ${folderName}`);
  }

  const folder = await createKeepNoteFolder(accessToken, folderName);
  return folder.id;
}

/**
 * Helper to get or create a folder on Google Drive
 */
async function createKeepNoteFolder(accessToken: string, folderName: string): Promise<any> {
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error('Folder creation error details:', err);
    throw new Error(`Failed to create Google Drive folder: ${folderName}`);
  }

  return await createRes.json();
}

/**
 * 7. Adds the reported community issue to the user's Google Keep as a note.
 */
export async function createKeepNote(accessToken: string, issue: Issue): Promise<void> {
  const payload = {
    title: `Community Case Note: ${issue.title}`,
    body: {
      text: {
        text: `Category: ${issue.category}\n` +
              `Severity: ${issue.severity}\n` +
              `Address: ${issue.address}\n` +
              `Trust rating: ${issue.trust_score || 50}%\n` +
              `Summary: ${issue.summary}`
      }
    }
  };

  const res = await fetch('https://keep.googleapis.com/v1/notes', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Keep error details:', errText);
    throw new Error('Failed to create Google Keep note');
  }
}

/**
 * 8. Exports a custom generated AI petition text into a newly created Google Doc inside the Drive folder.
 */
export async function exportPetitionToDocs(accessToken: string, issue: Issue, customPetitionText: string): Promise<string> {
  const folderId = await getOrCreateDriveFolder(accessToken, 'Community Hero Cases');
  
  const createDocRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `Official Civic Petition: ${issue.title}`,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId]
    })
  });

  if (!createDocRes.ok) {
    const err = await createDocRes.text();
    console.error('Docs creation error details:', err);
    throw new Error('Failed to create petition document in Google Drive');
  }

  const docFile = await createDocRes.json();
  const documentId = docFile.id;

  const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            text: customPetitionText,
            location: { index: 1 }
          }
        }
      ]
    })
  });

  if (!updateRes.ok) {
    throw new Error('Failed to write petition text into Google Doc');
  }

  return `https://docs.google.com/document/d/${documentId}/edit`;
}

/**
 * 9. Schedules a mobilization community town-hall / meeting with an automated Google Meet link.
 */
export async function scheduleCommunityMeet(
  accessToken: string,
  issue: Issue,
  meetingTime: string,
  customNotes: string
): Promise<{ eventLink: string; meetLink: string }> {
  const start = new Date(meetingTime);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // Default to 1-hour session

  const eventPayload = {
    summary: `📣 Civic Mobilization: ${issue.title}`,
    location: 'Google Meet (Virtual Town Hall)',
    description: `${customNotes}\n\n` +
                 `--------------------------------------------------\n` +
                 `Mobilization meeting organized via Community Hero.\n` +
                 `Subject Hazard: "${issue.title}"\n` +
                 `Location Address: ${issue.address}\n` +
                 `Reference ID: ${issue.id}\n` +
                 `Safety Warning: ${issue.safety_warning || 'Use standard neighborhood precaution.'}`,
    start: {
      dateTime: start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    conferenceData: {
      createRequest: {
        requestId: `meet-${issue.id}-${Date.now()}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet'
        }
      }
    },
    reminders: {
      useDefault: true
    }
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventPayload)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Meet scheduling error details:', errText);
    throw new Error('Failed to create Calendar event with Google Meet connection');
  }

  const createdEvent = await res.json();
  
  // Extract Meet Link if available
  let meetLink = '';
  if (createdEvent.conferenceData && createdEvent.conferenceData.entryPoints) {
    const videoEP = createdEvent.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
    if (videoEP) {
      meetLink = videoEP.uri;
    }
  }

  return {
    eventLink: createdEvent.htmlLink || 'https://calendar.google.com',
    meetLink: meetLink || 'https://meet.google.com'
  };
}

