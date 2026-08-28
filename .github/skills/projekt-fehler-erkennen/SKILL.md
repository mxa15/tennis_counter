---
name: projekt-fehler-erkennen
description: "Find and explain errors in the tennis_punktezahler project. Use when debugging Node.js, Express, PostgreSQL, authentication, WebSocket, HTML, CSS, or browser JavaScript problems; when the user reports that a feature is broken; or when they ask to check the project for bugs."
argument-hint: "Beschreibe den Fehler oder die Funktion, die geprüft werden soll"
user-invocable: true
---

# Projektfehler erkennen

## Ziel

Untersuche das Projekt systematisch, bis die gemeldete Fehlfunktion reproduzierbar eingegrenzt ist. Liefere konkrete Befunde mit Datei, Stelle, Ursache, Auswirkung und einem kleinen, passenden Lösungsvorschlag. Ändere keinen Code ohne ausdrücklichen Auftrag.

## Vorgehen

1. Lies die Fehlermeldung, den betroffenen Ablauf und die vom Nutzer genannten Reproduktionsschritte. Wenn Angaben fehlen, formuliere höchstens eine kurze Rückfrage; führe parallel mögliche lokale Prüfungen aus.
2. Identifiziere den direkt steuernden Codepfad. Beginne bei `package.json`, `server.js` oder der betroffenen HTML-/CSS-/JavaScript-Datei und verfolge Requests, Responses, Datenbankzugriffe und Browser-Ereignisse bis zur Fehlerstelle.
3. Prüfe zuerst den billigsten Gegencheck:
   - `npm start` für Start-, Konfigurations- und Laufzeitfehler
   - `node --check <datei>.js` für JavaScript-Syntax
   - `npm ls` für fehlende oder inkonsistente Abhängigkeiten
   - HTTP-Status und Response der betroffenen Route
   - Browser-Konsole und Netzwerk-Tab bei Frontend-Fehlern
4. Prüfe danach gezielt die passende Schicht:
   - Express: Route, Middleware-Reihenfolge, Request-Body, Statuscodes und Fehlerbehandlung
   - PostgreSQL: Umgebungsvariablen, Tabellen-/Spaltennamen, Constraints, Parameterbindung und fehlende `try/catch`-Pfade
   - Authentifizierung: Session-Cookie, Ablauf, `secure`-Verhalten, Berechtigungsprüfung und Passwortvergleich
   - WebSocket: Verbindungsaufbau, Nachrichtenformat, Verbindungsabbruch und Synchronisierung des Spielstands
   - Frontend: Pfade zu `/public`, DOM-Selektoren, JSON-Verträge, Event-Handler und responsive CSS-Regeln
5. Unterscheide sicher zwischen reproduzierten Fehlern, wahrscheinlichen Ursachen und offenen Vermutungen. Prüfe Eingaben, Grenzfälle und konkurrierende Requests, wenn der Code sie berührt.
6. Schlage die kleinste Änderung an der Ursache vor. Falls der Auftrag ausdrücklich eine Reparatur verlangt, implementiere sie mit dem vorhandenen Stil und füge nur dann einen Test hinzu, wenn ein lokales Testmuster oder ein klarer reproduzierbarer Check existiert.
7. Führe nach einer Änderung denselben fokussierten Check erneut aus und prüfe anschließend die betroffene Route oder den betroffenen Ablauf. Keine Zugangsdaten aus `.env` ausgeben oder in Dateien übernehmen.

## Ergebnisformat

Beginne mit den Befunden, nach Schweregrad sortiert:

```text
HOCH: [kurzer Titel]
Datei/Stelle: [Pfad und Zeile]
Ursache: [konkreter Kontrollfluss oder Datenfehler]
Auswirkung: [was der Nutzer beobachtet]
Nachweis: [ausgeführter Check und Ergebnis]
Empfehlung: [kleinste sinnvolle Reparatur]
```

Danach nenne offene Annahmen, nicht ausführbare Checks und verbleibende Risiken. Wenn keine Fehler reproduziert wurden, sage das ausdrücklich und liste die ausgeführten Checks sowie die Testlücken auf. Behaupte keinen erfolgreichen Lauf, wenn Datenbank, Browser oder Umgebungsvariablen nicht verfügbar waren.

## Abschlusskriterien

- Der betroffene Ablauf und die verantwortliche Code-Stelle sind benannt.
- Jeder Befund ist durch Fehlermeldung, reproduzierbaren Check oder nachvollziehbaren Codepfad belegt.
- Reproduzierte Fehler und Vermutungen sind klar getrennt.
- Keine Secrets oder vollständigen `.env`-Werte wurden offengelegt.
- Nach Reparaturen wurde mindestens ein fokussierter ausführbarer Check wiederholt.
