import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class OrdnerDurchlauf {

    public static List<String> durchlaufeOrdner(String ordnerPfad) {
        List<String> songPfade = new ArrayList<>(); // Liste für die Song-Pfade
        File ordner = new File(ordnerPfad);

        if (ordner.isDirectory()) {
            File[] dateien = ordner.listFiles();
            if (dateien != null) {
                for (File datei : dateien) {
                    if (datei.isDirectory()) {
                        // Rekursiver Aufruf und Zusammenführen der Listen
                        songPfade.addAll(durchlaufeOrdner(datei.getAbsolutePath()));
                    } else {
                        // Nur MP3-Dateien hinzufügen
                        if (datei.getName().toLowerCase().endsWith(".mp3")) {
                            songPfade.add(datei.getAbsolutePath());
                        }
                    }
                }
            }
        }
        return songPfade; // Die Liste der Song-Pfade zurückgeben
    }

    public static void main(String[] args) {
        List<String> songListe = durchlaufeOrdner("C:/Users/Cohen/Music");

        // Ausgabe der gefundenen Songs (nur zur Demonstration)
        System.out.println("Gefundene Songs:");
        for (String songPfad : songListe) {
            System.out.println(songPfad);
        }

        // Hier übergibst du die songListe an deinen Musikplayer
        // Beispiel:
        // MusikPlayer player = new MusikPlayer();
        // player.spieleSongs(songListe);
    }
}