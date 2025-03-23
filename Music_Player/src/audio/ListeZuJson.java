import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.IOException;
import java.util.List;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import OrdnerDurchlauf;

public class ListeZuJson {

    public static void schreibeListeAlsJson(List<String> liste, String dateiPfad) {
        // Gson-Objekt erstellen, um die Liste in JSON umzuwandeln
        Gson gson = new GsonBuilder().setPrettyPrinting().create();

        // Liste in JSON-String umwandeln
        String json = gson.toJson(liste);

        // JSON-String in die Datei schreiben
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(dateiPfad))) {
            writer.write(json);
            System.out.println("Liste erfolgreich in " + dateiPfad + " geschrieben.");
        } catch (IOException e) {
            System.err.println("Fehler beim Schreiben der Datei: " + e.getMessage());
        }
    }

    public static void main(String[] args) {
        // Beispiel-Liste
        List<String> meineListe = List.of("Element 1", "Element 2", "Element 3");

        // Funktion aufrufen, um die Liste in eine JSON-Datei zu schreiben
        schreibeListeAlsJson(meineListe, "meine_liste.json");
    }
}