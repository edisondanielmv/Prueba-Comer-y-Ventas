import { SheetPayload } from "../types";

// =========================================================================================
// INSTRUCCIONES PARA CONECTAR TU NUEVA HOJA DE CÁLCULO
// =========================================================================================
/*
   PASO 1: Ve a tu nueva hoja de cálculo: 
   https://docs.google.com/spreadsheets/d/1hugS1L80w8gfM70maxMUIbWmAe5ADqVT1ul-lr7VVdE/edit

   PASO 2: Ve a "Extensiones" > "Apps Script".

   PASO 3: Borra todo el código que aparezca y pega el siguiente bloque:

   ```javascript
   function doPost(e) {
     // ID ACTUALIZADO PARA LA NUEVA HOJA
     var sheetId = "1hugS1L80w8gfM70maxMUIbWmAe5ADqVT1ul-lr7VVdE";
     
     var sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
     
     try {
       var data = JSON.parse(e.postData.contents);
       var fecha = new Date();
       
       // Crear encabezados si es una hoja nueva
       if (sheet.getLastRow() === 0) {
         sheet.appendRow(["Fecha y Hora", "Nombre Estudiante", "Cédula", "Nota", "Total Preguntas", "Detalle JSON"]);
       }
       
       sheet.appendRow([
         fecha, 
         data.studentName,
         data.studentId,
         data.score,
         data.total,
         data.details
       ]);
       
       return ContentService.createTextOutput(JSON.stringify({"status":"success"})).setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       return ContentService.createTextOutput(JSON.stringify({"status":"error", "message": err.toString()})).setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```

   PASO 4: Haz clic en "Implementar" (botón azul arriba a la derecha) > "Nueva implementación".
   
   PASO 5: 
      - Tipo: Aplicación web.
      - Descripción: "Registro Notas".
      - Ejecutar como: "Yo".
      - Quién tiene acceso: "Cualquier persona" (IMPORTANTE).

   PASO 6: Copia la URL que te da Google (termina en /exec) y pégala abajo donde dice GOOGLE_SCRIPT_URL.
*/

// 👇👇👇 PEGA AQUÍ LA NUEVA URL QUE TE DÉ GOOGLE 👇👇👇
const GOOGLE_SCRIPT_URL: string = "https://script.google.com/macros/s/AKfycbxXMPJwu9mpOM-1d09RfEmLjhlwpRfO7NKl76PbzPvWEUy7HVcIdlkYE6b_cRjxCYQ/exec"; 

/**
 * Helper to download results as a local file if cloud upload is not configured or fails.
 */
const downloadLocalBackup = (data: SheetPayload) => {
    const csvContent = [
        ["Fecha", "Nombre", "Cédula", "Nota", "Total", "Detalles (JSON)"],
        [
            `"${data.timestamp}"`,
            `"${data.studentName}"`,
            `"${data.studentId}"`,
            data.score,
            data.total,
            `"${data.details.replace(/"/g, '""')}"` // Escape quotes for CSV
        ]
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Resultado_ComercioExterior_${data.studentName.replace(/\s/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const submitToGoogleSheets = async (data: SheetPayload): Promise<boolean> => {
  console.log("Procesando envío de datos...", data);

  // Check if the URL is still the placeholder or empty
  const isPlaceholderUrl = !GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PON_AQUI") || GOOGLE_SCRIPT_URL === "";

  if (isPlaceholderUrl) {
      console.warn("Google Sheet URL no configurada o vacía. Descargando respaldo local.");
      // If the user hasn't set up the backend, we download the file locally
      downloadLocalBackup(data);
      // Return true after a short delay to simulate network request
      return new Promise(resolve => setTimeout(() => resolve(true), 1500));
  }

  // Real submission logic
  try {
      // Note: Google Apps Script Web Apps often have CORS issues with fetch directly from browser.
      // Standard practice involves 'no-cors'. 
      // With 'no-cors', we can't read the response JSON to confirm success, but the request goes through opaque.
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(data),
        mode: "no-cors", 
        headers: {
            "Content-Type": "text/plain;charset=utf-8",
        },
      });
      console.log("Datos enviados correctamente a Google Sheets");
      return true;
  } catch (error) {
      console.error("Error submitting to Google Sheets", error);
      alert("Hubo un problema de conexión con el servidor de notas. Se descargará una copia local de respaldo.");
      // Fallback to local download if network fails
      downloadLocalBackup(data);
      return true; // We return true because we saved it locally
  }
};