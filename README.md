# Musikplayer (Electron)

## Beschreibung

Dies ist ein einfacher Musikplayer, der mit Electron entwickelt wurde. Er ermöglicht es Benutzern, Musikdateien aus einem ausgewählten Ordner abzuspielen. Das Projekt befindet sich noch in der Entwicklung, aber die grundlegende Musikwiedergabe ist bereits implementiert.

## Funktionen

*   **Ordnerauswahl:** Benutzer können einen Ordner auswählen, der ihre Musikdateien enthält.
*   **Musikwiedergabe:** MP3-Dateien aus dem ausgewählten Ordner können abgespielt werden.
*   **Wiedergabesteuerung:**
    *   Play/Pause
    *   Nächster Titel
    *   Vorheriger Titel
*   **Titelliste:** Anzeige der verfügbaren Titel im ausgewählten Ordner.
*   **Aktueller Titel:** Anzeige des aktuell abgespielten Titels.
* **Fehlermeldungen:** Anzeige von Fehlermeldungen, falls ein Track nicht geladen werden kann.

## Technologie

*   **Electron:** Ermöglicht die Erstellung einer plattformübergreifenden Desktop-Anwendung mit Webtechnologien.
*   **Node.js:** Wird für den Zugriff auf das Dateisystem und die Kommunikation zwischen Haupt- und Renderer-Prozess verwendet.
*   **JavaScript:** Die Hauptprogrammiersprache für die Logik und die Benutzeroberfläche.
*   **HTML/CSS:** Für die Struktur und das Styling der Benutzeroberfläche.
* **API** Es wird ein Server erstellt der die Route zu den Ordner über den PORT 3001 zurverfügung stellt

## Installation und Ausführung

1.  **Voraussetzungen:**
    *   Node.js und npm müssen auf deinem System installiert sein.
    *   Electron muss installiert sein.
2.  **Klonen des Repositories:**
    ```bash
    git clone [URL des Repositories]
    cd [Name des Ordners]
    ```
3.  **Installation der Abhängigkeiten:**
    ```bash
    npm install
    ```
4.  **Starten der Anwendung:**
    ```bash
    npm start
    ```

## Bedienung

1.  **Ordner auswählen:** Klicke auf die Schaltfläche "Ordner auswählen", um den Ordner mit deinen Musikdateien auszuwählen.
2.  **Musik abspielen:** Die verfügbaren Titel werden in der Titelliste angezeigt. Klicke auf einen Titel, um ihn abzuspielen.
3.  **Wiedergabe steuern:** Verwende die Play/Pause-, Nächster Titel- und Vorheriger Titel-Schaltflächen, um die Wiedergabe zu steuern.

## Bekannte Einschränkungen

*   **Nur MP3:** Derzeit werden nur MP3-Dateien unterstützt.
*   **Keine Playlist-Funktion:** Es gibt noch keine Möglichkeit, Playlists zu erstellen oder zu verwalten.
*   **Keine Metadaten:** Es werden keine Metadaten (z.B. Künstler, Album) angezeigt.
* **Keine Suche:** Es gibt noch keine Suchfunktion.
* **Keine Shuffle/Repeat:** Es gibt noch keine Shuffle oder Repeat Funktion.
* **Einfache Oberfläche:** Die Benutzeroberfläche ist noch sehr einfach gehalten.

## Zukünftige Entwicklung

Die folgenden Funktionen sind für zukünftige Versionen geplant:

*   Unterstützung für weitere Audioformate (z.B. WAV, FLAC).
*   Playlist-Verwaltung.
*   Anzeige von Metadaten.
*   Zufallswiedergabe (Shuffle).
*   Wiederholung (Repeat).
*   Suchfunktion.
*   Verbesserung der Benutzeroberfläche.
*   Weitere Fehlerbehebungen und Optimierungen.

## Mitwirken

Beiträge zu diesem Projekt sind willkommen! Wenn du Fehler findest oder Verbesserungsvorschläge hast, erstelle bitte ein Issue oder einen Pull Request.

## Kontakt

Bei Fragen oder Anregungen kannst du dich gerne an lastxhunterx.css@gmail.com wenden.
