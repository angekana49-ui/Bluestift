import type { Messages } from "./index";

/** German. Partial by design — any key left out falls back to English. */
export const de: Partial<Messages> = {
  "nav.chat": "Chat",
  "nav.rooms": "Räume",
  "nav.tools": "Werkzeuge",
  "nav.homework": "Hausaufgaben",
  "nav.kernel": "Mein Kernel",
  "nav.settings": "Einstellungen",

  "nav.overview": "Übersicht",
  "nav.classes": "Klassen",
  "nav.classesCodes": "Klassen & Codes",
  "nav.focus": "Fokus",
  "nav.prepare": "Vorbereiten",
  "nav.insights": "Analysen",
  "nav.reports": "Berichte",
  "nav.team": "Team",
  "nav.billing": "Abrechnung",

  "menu.addEmail": "E-Mail hinzufügen",
  "menu.addEmail.sub": "Sichere deinen Fortschritt",
  "menu.settings": "Einstellungen",
  "menu.kernel": "Mein Kernel",
  "menu.upgrade": "Tarif wechseln",
  "menu.upgrade.sub": "Mehr Funktionen freischalten",
  "menu.signOut": "Abmelden",
  "menu.personalRaya": "Dein persönliches Raya",
  "menu.personalRaya.sub": "Dein eigenes Konto · privat",

  "shell.openMenu": "Menü öffnen",
  "shell.openPanel": "Panel öffnen",
  "shell.expandSidebar": "Seitenleiste ausklappen",
  "shell.collapseSidebar": "Seitenleiste einklappen",
  "shell.expand": "Ausklappen",
  "shell.collapse": "Einklappen",

  "settings.language.title": "Sprache",
  "settings.language.desc": "Wähle die Sprache der Oberfläche",

  "site.nav.product": "Produkt",
  "site.nav.research": "Forschung",
  "site.nav.survey": "Umfrage",
  "site.nav.pricing": "Preise",
  "site.nav.contact": "Kontakt",
  "site.nav.privacy": "Datenschutz",
  "site.nav.signIn": "Anmelden",
  "site.nav.startFree": "Kostenlos starten",
  "site.nav.openApp": "App öffnen",

  "site.hero.eyebrow": "Die kollaborative KI für die Bildung",
  "site.hero.headline": "Erst die Diagnose. Dann das Lernen.",
  "site.hero.sub":
    "Nicht weiterzukommen ist kein Mangel an Begabung. Es ist ein fehlender Schritt — und Raya geht so weit zurück, bis er gefunden ist.",
  "site.hero.ctaPrimary": "Kostenlos ausprobieren",
  "site.hero.ctaSecondary": "So funktioniert es",
  "site.hero.chip.scope": "Jedes Fach, jedes Niveau",
  "site.hero.chip.noCard": "Keine Karte nötig",
  "site.hero.chip.solo": "Allein oder mit deiner Klasse",

  "site.connection.title.a": "Eine KI,",
  "site.connection.title.em": "auf beiden Seiten",
  "site.connection.title.b": "des Klassenzimmers.",
  "site.connection.sub":
    "Die eine Seite verteilt, die andere nimmt auf, und dazwischen liegen ein Lehrplan, eine Note — und jetzt zwei private KIs. Hausaufgaben trugen früher wenigstens ein Signal darüber, wie jemand denkt. Das tun sie nicht mehr. Raya ersetzt das alles durch einen gemeinsamen Faden.",
  "site.connection.step1.title": "Die Lehrkraft sagt, worauf es ankommt",
  "site.connection.step1.body":
    "Ein Schwerpunkt für die Klasse, in einem Satz — die wackelige Voraussetzung, das Kapitel, das nicht ankommt. Er erreicht Raya, und alle Lernenden sehen ihn, deutlich gekennzeichnet.",
  "site.connection.step2.title": "Die Lernenden arbeiten mit Raya",
  "site.connection.step2.body":
    "Fragen vor Antworten, Schritt für Schritt, in der eigenen Sprache. Raya greift den Schwerpunkt der Lehrkraft auf, wenn er passt — sie leitet an, sie diktiert nie.",
  "site.connection.step3.title": "Das Verstandene kommt zurück",
  "site.connection.step3.body":
    "Konzept für Konzept, samt der Voraussetzung, die wirklich blockiert — am nächsten Morgen, nicht am Ende des Halbjahres.",
  "site.connection.guard.strong": "Verstehen, nicht überwachen.",
  "site.connection.guard.body":
    "Eine Lehrkraft sieht, welche Konzepte sitzen und welche noch wackeln — nie die Gespräche. Der Tutor bleibt ein Ort, an dem man zugeben darf, dass man nicht weiterkommt.",

  "site.features.title.more": "Mehr als",
  "site.features.title.em1": "ein Chatbot.",
  "site.features.title.em2": "ein Dashboard.",
  "site.features.sub": "Drei Oberflächen, ein Profil darunter. Nichts einzurichten, nichts zu pflegen.",
  "site.features.kernel.title": "Cognitive Kernel",
  "site.features.kernel.desc":
    "Kompetenz Konzept für Konzept gemessen, nicht als eine unscharfe Note — inklusive der Voraussetzung, die alles Übrige still blockiert. Genau das geht zurück an die Person, die dich unterrichtet.",
  "site.features.rooms.title": "Lernräume",
  "site.features.rooms.desc":
    "Gemeinsam in Echtzeit wiederholen, mit Raya im Raum und Dokumenten, mit denen alle arbeiten können. Lernen ist sozial — ein Tutor sollte dich nicht allein in die Ecke setzen.",
  "site.features.challenges.title": "Challenges & Werkzeuge",
  "site.features.challenges.desc":
    "Zusammenfassungen, Lernkarten und Mindmaps aus jeder Lektion, dazu Quiz, Tests und Gruppen-Challenges mit Live-Rangliste. Jeder Versuch fließt in dasselbe Profil.",

  "site.ladder.eyebrow": "Pädagogisches Modell",
  "site.ladder.title.a": "Eine Leiter zum Steigen, kein",
  "site.ladder.title.em": "Antwortautomat.",
  "site.ladder.sub":
    "Raya steigt Sprosse für Sprosse und beginnt nie oben. Das Ziel ist nicht die richtige Antwort in dreißig Sekunden, sondern eine Lernende oder ein Lernender, die es nächste Woche allein wieder kann.",
  "site.ladder.r1.name": "Anstoß",
  "site.ladder.r1.title": "Hervorholen, was schon da ist",
  "site.ladder.r1.body":
    "Jeder Austausch beginnt mit der Bitte um einen Versuch oder eine Erinnerung. Nichts wird vor einem echten Versuch herausgegeben — selbst ein misslungener verankert das Konzept stärker.",
  "site.ladder.r2.name": "Hinweis",
  "site.ladder.r2.title": "Den Suchraum verengen",
  "site.ladder.r2.body":
    "Ein Teilhinweis, und erst nach einem Versuch. Er zeigt auf den nächsten Schritt, ohne ihn zu gehen; das Denken bleibt beim Lernenden.",
  "site.ladder.r3.name": "Aussage",
  "site.ladder.r3.title": "Das fehlende Stück benennen",
  "site.ladder.r3.body":
    "Genau der Punkt, der blockiert, klar ausgesprochen — aber erst, wenn Hinweise gescheitert sind. Nie die fertige Lösung.",
  "site.ladder.r4.name": "Zusammenfassung",
  "site.ladder.r4.title": "Den Kreis schließen",
  "site.ladder.r4.body":
    "Ein Rückblick zum Abschluss der Sitzung oder zum Lösen einer echten Blockade. Bewertet wird, was der Lernende selbst wiedergibt.",
  "site.ladder.note":
    "Das ist keine Einstellung, die eine Schule aktiviert. Raya ist so gebaut, dass sie keine fertige Antwort herausgeben kann — und ihr Feedback zielt auf die Methode, nie auf die Person, wie es Carol Dwecks Arbeit nahelegt: „Hier stolpern viele“, nie „du bist begabt“.",

  "site.kernel.eyebrow": "Kognitiver Kern",
  "site.kernel.title.a": "Vier Dimensionen,",
  "site.kernel.title.em": "sieben Warnsignale.",
  "site.kernel.sub":
    "Der Kern speichert keine Note. Jedes Konzept trägt einen vierteiligen Vektor — und sobald ein Signal kippt, benennt er das Problem, damit Raya schon im nächsten Zug die Taktik wechselt.",
  "site.kernel.map.title": "Alles kreist um eine einzige Person.",
  "site.kernel.map.body":
    "Raya, die Klassenversion, die benoteten Aufgaben — keines davon hält eine eigene Kopie der lernenden Person. Alle schreiben in dasselbe Profil und lesen es zurück, bevor sie antworten, während das Gespräch noch läuft.",
  "site.kernel.k.name": "K · Wissen",
  "site.kernel.k.title": "Was ohne Hilfe trägt",
  "site.kernel.k.body": "Die Beherrschung genau dieses Konzepts, roh und angepasst, nach jedem Versuch neu berechnet.",
  "site.kernel.v.name": "V · Tempo",
  "site.kernel.v.title": "Wie schnell es sich bewegt",
  "site.kernel.v.body": "Die beobachtete Lernrate: ein langsamer Anstieg liest sich anders als ein völliger Stillstand.",
  "site.kernel.p.name": "P · Beständigkeit",
  "site.kernel.p.title": "Was die Woche übersteht",
  "site.kernel.p.body": "Widerstand gegen das Vergessen: ein am Montag gesichertes Konzept, das bis Freitag wegrutscht, fällt auf.",
  "site.kernel.m.name": "M · Haltung",
  "site.kernel.m.title": "Das Verhältnis zum Fehler",
  "site.kernel.m.body": "Ob Anstrengung als Information gilt oder als Beweis des Scheiterns. Pro Lernendem erfasst, nicht pro Konzept.",
  "site.kernel.graph.title": "Der Fehler lag in Physik. Die Ursache in Mathematik.",
  "site.kernel.graph.body":
    "Konzepte liegen als Struktur vor, nicht als Lehrplan. Wenn etwas bricht, hält der Kernel deshalb nicht bei der misslungenen Aufgabe an: Er geht zurück über das, worauf das Konzept ruht, bis er auf tragfähigen Boden trifft. Dieser Boden liegt oft in einem Fach, in dem niemand nachgesehen hätte.",
  "site.kernel.col.alert": "Warnsignal",
  "site.kernel.col.signal": "Erkanntes Signal",
  "site.kernel.col.response": "Rayas Reaktion",
  "site.kernel.a1.name": "Passive Abhängigkeit",
  "site.kernel.a1.signal": "Kurze Antworten, kein Versuch — es wird darauf gewartet, die Lösung zu bekommen.",
  "site.kernel.a1.response": "Raya eskaliert nicht und fordert einen echten Versuch, auf einer offeneren Aufgabe.",
  "site.kernel.a2.name": "Scheinbeherrschung",
  "site.kernel.a2.signal": "Richtige Antworten, aber die Begründung fehlt oder ist auswendig gelernt.",
  "site.kernel.a2.response": "Sofortige Gegenprobe in einem schwereren, neuen Kontext, bevor das Können als gesichert gilt.",
  "site.kernel.a3.name": "Wiederkehrender Fehler",
  "site.kernel.a3.signal": "Ein bereits bestätigtes Konzept bricht Wochen später erneut ein.",
  "site.kernel.a3.response": "Das Konzept wird in kleinere Schritte zerlegt und von der Voraussetzung an neu aufgebaut.",
  "site.kernel.a4.name": "Kognitive Überlastung",
  "site.kernel.a4.signal": "Zu viel gleichzeitig im Kopf; die Aufgabe übersteigt das Arbeitsgedächtnis.",
  "site.kernel.a4.response": "Die Komplexität wird reduziert, ein durchgerechnetes Beispiel ersetzt die Übung.",
  "site.kernel.a5.name": "Starre Haltung",
  "site.kernel.a5.signal": "„Ich bin einfach schlecht in Mathe“ — aufgeben vor dem ersten Versuch.",
  "site.kernel.a5.response": "Zuerst eine auf die Methode gerichtete Einordnung, bevor ein neuer Versuch vorgeschlagen wird.",
  // Die letzten beiden betreffen den Kern selbst, nicht die Lernenden.
  "site.kernel.a6.name": "Instabile Schätzung",
  "site.kernel.a6.signal": "Der Wert wandert, statt sich zu setzen — richtig, dann falsch, dann richtig, beim selben Konzept.",
  "site.kernel.a6.response": "Raya bittet um einen sauberen Versuch ohne Hinweise, und auf diesem Konzept wird nichts aufgebaut, solange es nicht still hält.",
  "site.kernel.a7.name": "Außerhalb der Kalibrierung",
  "site.kernel.a7.signal": "Diese Person verhält sich nicht wie die Population, auf die die Parameter angepasst wurden.",
  "site.kernel.a7.response": "Raya geht nach dem, was dieser Zug zeigt, statt nach dem gespeicherten Wert — und erhöht die Schwierigkeit nicht auf dessen Grundlage.",

  "site.pos.eyebrow": "Wo das sitzt",
  "site.pos.title.a": "Die Schicht zwischen",
  "site.pos.title.em": "den beiden, die ihr schon zahlt.",
  "site.pos.sub":
    "Euer LMS hält fest, was getan wurde — an den Tagen, an denen etwas fällig ist. Ein Tutor hilft im Moment, und dann ist der Moment vorbei. Keines von beiden bewahrt, was Lernende tatsächlich verstanden haben — an einem gewöhnlichen Dienstag, ohne Abgabe und ohne laufende Sitzung, gibt es also nichts zu lesen.",
  "site.pos.note.model":
    "Alles in dieser Kategorie läuft auf eingekauften Frontier-Modellen. Dieses auch, bei denselben Anbietern. Das Modell ist der Boden — zwischen Modellen wird nicht entschieden. Zwischen dem, was darüber festgehalten wird, schon.",
  "site.pos.note.privacy":
    "Und dieser Datensatz ist absichtlich schmal. Eine Lehrkraft sieht, dass Ableitungen brüchig sind. Sie sieht nicht, was gesagt wurde — also weniger, als das vorhandene Notenbuch über dieselbe Person ohnehin weiß.",

  "site.roadmap.eyebrow": "Roadmap",
  "site.roadmap.title.a": "Wo das Produkt",
  "site.roadmap.title.em": "wirklich steht.",
  "site.roadmap.sub":
    "Was läuft, was gerade entsteht, was kommt. Nichts oben ist der Screenshot einer Funktion, die es noch nicht gibt.",
  "site.roadmap.status.shipped": "Fertig",
  "site.roadmap.status.progress": "In Arbeit",
  "site.roadmap.status.coming": "Geplant",
  "site.roadmap.i1.title": "Sokratische Sitzungen und kognitiver Kern",
  "site.roadmap.i1.body":
    "Die Leiter Anstoß → Hinweis → Aussage → Zusammenfassung, der Vektor pro Konzept und die sieben Warnsignale — in jeder Sitzung aktiv.",
  "site.roadmap.i2.title": "Schul-Arbeitsbereich",
  "site.roadmap.i2.body":
    "Selbstständige Einrichtung, Rollen für Verwaltung und Lehrkräfte, Klassen, Einladungscodes und Team-Beitritte, Auswertungen nach Klasse und Fach.",
  "site.roadmap.i3.title": "Lernräume, Challenges und Werkzeuge",
  "site.roadmap.i3.body":
    "Live-Gruppenräume mit gemeinsamen Dokumenten, Gruppen-Challenges mit Rangliste sowie Quizze, Zusammenfassungen, Lernkarten und Mindmaps aus einer Unterrichtsstunde.",
  "site.roadmap.i4.title": "Zahlungen und Kontingente",
  "site.roadmap.i8.title": "Läuft auch bei schwachem Netz",
  "site.roadmap.i8.body":
    "Die Oberfläche liegt nach dem ersten Besuch auf dem Gerät und öffnet ohne Warten auf das Netz; Schreibvorgänge werden in eine Warteschlange gelegt und wiederholt, statt verloren zu gehen.",
  "site.roadmap.i4.body":
    "Karte, Mobile Money und PayPal über einen einzigen Aggregator, dazu die Tarifgrenzen. Der komplette Zahlungsablauf läuft in der Sandbox — das echte Einziehen ist nicht freigeschaltet. Die Grenzen werden gezählt und gemeldet und weisen noch niemanden ab.",
  "site.roadmap.i5.title": "Verlaufskurve pro Konzept",
  "site.roadmap.i5.body":
    "Eine echte Projektion im Kern statt der modellgestützten Schätzung, die das Profil heute zeigt.",
  "site.roadmap.i6.title": "LMS-Abgleich",
  "site.roadmap.i6.body":
    "Anmeldung über Google Classroom, dann Import von Klassen und Namenslisten aus der bestehenden Umgebung — nur lesend, statt alles erneut einzutippen. Vollständig gebaut; wird pro Deployment aktiv, sobald die Google-Zugangsdaten hinterlegt sind.",
  "site.roadmap.i7.title": "Audio-Zusammenfassungen und Infografiken",
  "site.roadmap.i7.body":
    "Eine Lektion, die man auf dem Schulweg hören oder als ein einziges Bild lesen kann. Entworfen, nicht gebaut — und bewusst auf keiner Preisübersicht, solange das so ist.",

  "site.faq.title.a": "Häufige",
  "site.faq.title.em": "Fragen.",
  "site.faq.model.q": "Ist das nicht ChatGPT mit einem System-Prompt?",
  "site.faq.model.a":
    "Das Modell darunter ist ein zugekauftes Spitzenmodell. Deren Modell auch — das ist der Boden, nicht der Unterschied. Darüber liegt eine Aufzeichnung: Jeder Versuch wird Konzept für Konzept in ein einziges Profil bewertet, das der Tutor und die Lehrkraft beide lesen. Ein Prompt ist keine Aufzeichnung, und er ist weg, sobald der Tab schließt.",
  "site.faq.lms.q": "Wir zahlen bereits für ein LMS. Warum noch ein Werkzeug?",
  "site.faq.lms.a":
    "Das hier ist keins und will keins sein. Euer LMS hält fest, was aufgegeben und was abgegeben wurde; das hier hält fest, was verstanden wurde — eine Spalte, die kein Notenbuch je hatte. Beide verbinden sich, statt zu konkurrieren: Google Classroom wird angebunden, Klassen und Listen kommen von dort, wo sie ohnehin leben.",
  "site.faq.sees.q": "Was sieht eine Lehrkraft tatsächlich?",
  "site.faq.sees.a":
    "Welche Konzepte gesichert sind, welche noch wackeln und welche Voraussetzung den Rest blockiert — nie die Gespräche mit Raya. Wer sich gelesen fühlt, gibt nicht mehr zu, was er nicht versteht.",
  "site.faq.training.q": "Wird die Arbeit unserer Schülerinnen und Schüler zum Modelltraining genutzt?",
  "site.faq.training.a":
    "Nein, außer eine erwachsene Person schaltet es für ihr eigenes Konto ein. Das Alter wird geprüft, bevor das Einwilligungsfeld überhaupt gelesen wird: Das Konto einer minderjährigen Person lässt sich gar nicht einbeziehen, auch nicht durch Ankreuzen. Und schlägt diese Prüfung fehl, lautet die Antwort nein.",
  "site.faq.curriculum.q": "Müssen wir unseren Lehrplan importieren?",
  "site.faq.curriculum.a":
    "Nein. Konzepte werden aus den hochgeladenen Dokumenten gewonnen und an den bestehenden Graphen gehängt. Eine einzige Unterrichtsstunde reicht zum Start.",
  "site.faq.offline.q": "Funktioniert es bei schwacher Verbindung?",
  "site.faq.offline.a":
    "Ja. Die Oberfläche ist leicht und liegt nach dem ersten Besuch im Cache des Geräts — sie öffnet, ohne aufs Netz zu warten. Das Profil bleibt auf dem Server, also wird auf einem günstigen Telefon nichts Schweres neu berechnet.",

  "site.finalCta.title.a": "Raya mit",
  "site.finalCta.title.em": "einer Klasse testen.",
  "site.finalCta.sub": "Kostenlos starten, ohne Karte. Die Lernenden legen los; den Rest macht der Kern.",
  "site.finalCta.ctaPrimary": "Kostenlos starten",
  "site.finalCta.ctaSecondary": "Mit dem Team sprechen",
  "site.finalCta.note": "Allein oder mit der Klasse. Nichts zu installieren.",

  "site.pricing.title.a":"Preise, die",
  "site.pricing.title.em": "einfach bleiben.",
  "site.pricing.sub": "Drei Einstiege — einzeln lernen, eine ganze Schule oder eine maßgeschneiderte Lösung. Wähle deinen.",
  "site.pricing.solo.title": "Solo",
  "site.pricing.solo.l1": "Allein lernen, Raya an deiner Seite",
  "site.pricing.solo.l2": "Kompetenz Konzept für Konzept verfolgt",
  "site.pricing.solo.l3": "Lernräume und Gruppen-Challenges, live",
  "site.pricing.solo.l4": "Quiz, Zusammenfassungen, Lernkarten, Mindmaps",
  "site.pricing.solo.cta": "Solo-Tarife ansehen",
  "site.pricing.schools.l1": "Eine Klasse, ein Jahrgang oder die ganze Schule",
  "site.pricing.schools.l2": "Lehrkraft-Dashboards + Analysen pro Klasse",
  "site.pricing.schools.l3": "LMS-Sync + Raya for Schools",
  "site.pricing.schools.l4": "Abrechnung je eingeschriebener Person",
  "site.pricing.schools.region": "Schulpreise variieren je nach Region.",
  "site.pricing.schools.cta": "Schul-Tarife ansehen",
  "site.pricing.custom.title": "Individuell",
  "site.pricing.custom.l1": "Die volle Engine, auf deine Schule abgestimmt",
  "site.pricing.custom.l2": "Single Sign-on, mehrere Schulen unter einem Dach",
  "site.pricing.custom.l3": "LMS-Sync, und kein Limit auf irgendetwas",
  "site.pricing.custom.l4": "Eure Aufbewahrungsfrist, eure Exporte, euer AVV",
  "site.pricing.custom.meta": "Für Einrichtungen, die alles wollen",
  "site.pricing.custom.cta": "Individuell entdecken",
  "site.pricing.compare": "Alle Tarife vergleichen →",

  "site.footer.tagline": "BlueStift baut Raya — den KI-Tutor, den Lernende und Lehrkräfte endlich teilen.",
  "site.footer.col.product": "PRODUKT",
  "site.footer.col.project": "PROJEKT",
  "site.footer.col.resources": "RESSOURCEN",
  "site.footer.col.legal": "RECHTLICHES",
  "site.footer.link.studyRooms": "Lernräume",
  "site.footer.link.toolsStudio": "Werkzeug-Studio",
  "site.footer.link.contribute": "Mitwirken",
  "site.footer.link.progress": "Fortschritt",
  "site.footer.link.terms": "AGB",
  "site.footer.link.dpa": "Schul-AVV",
  "site.footer.link.subprocessors": "Unterauftragsverarbeiter",
  "site.footer.link.feedback": "Feedback",
  "site.footer.rights": "Alle Rechte vorbehalten.",

  // ── Netzwerk-Resilienz ────────────────────────────────────────────
  "net.offline": "Du bist offline. Raya verbindet sich automatisch neu.",
  "net.degraded": "Instabile Verbindung — manches kann etwas dauern.",
  "net.reconnected": "Wieder online.",
  "net.retry": "Erneut versuchen",
  "net.roomLiveDown": "Live-Updates pausiert — Verbindung wird wiederhergestellt. Senden geht weiterhin.",
  "chat.sendFailed": "Nicht gesendet — deine Nachricht ist gespeichert.",
  "chat.retry": "Erneut versuchen",
};
