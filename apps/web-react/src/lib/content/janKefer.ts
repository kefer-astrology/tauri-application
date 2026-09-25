import type { AppLanguage } from '@/lib/i18n';

/**
 * Short biography of Jan Kefer (1906-1941), the Czech astrologer and hermeticist this app is
 * named after. Summarized from the Czech Wikipedia article (cs.wikipedia.org/wiki/Jan_Kefer),
 * one paragraph array per supported UI language.
 */
export const JAN_KEFER_BIOGRAPHY: Readonly<Record<AppLanguage, readonly string[]>> = {
	en: [
		'Jan Kefer (1906-1941) was a Czech astrologer, occultist, and scholar of the Hermetic tradition — and the namesake of this application.',
		"Born in Nový Bydžov on 31 January 1906, he studied at the Archbishop's Gymnasium in Prague and later earned a doctorate in philosophy from Charles University in 1928. Fluent in twelve languages, he worked as a librarian at the National Museum, Strahov Monastery, and the Vatican Library, while pursuing a lifelong study of astrology, Kabbalah, alchemy, and magic.",
		'Kefer served as secretary and later chairman of Universalia, the Czechoslovak hermetic society, editing its journal Logos. He wrote and translated widely, including Practical Astrology (1939) and a Czech edition of the Tibetan Book of the Dead.',
		"During the Nazi occupation, Kefer used his craft in defiance of the regime — reportedly proposing symbolic 'astrological attacks' against Hitler to President Edvard Beneš, and later performing ritual workings against Hitler's own horoscope from within Universalia. Arrested by the Gestapo in June 1941 for statements against the occupation, he refused an offer to join the regime's own astrologers and died at Flossenbürg concentration camp on 3 December 1941, aged 35."
	],
	cs: [
		'Jan Kefer (1906-1941) byl český astrolog, okultista a badatel v oblasti hermetické tradice — a je také jmenovcem této aplikace.',
		'Narodil se 31. ledna 1906 v Novém Bydžově. Studoval na Arcibiskupském gymnáziu v Praze-Bubenči a v roce 1928 získal doktorát filozofie na Univerzitě Karlově. Ovládal dvanáct jazyků a pracoval jako knihovník v Národním muzeu, na Strahově a ve Vatikánské knihovně, přičemž se celoživotně věnoval studiu astrologie, kabaly, alchymie a magie.',
		'Byl tajemníkem a později předsedou hermetické společnosti Universalia a redigoval její časopis Logos. Hodně psal a překládal — je mimo jiné autorem Praktické astrologie (1939) a překladatelem české verze Tibetské knihy mrtvých.',
		"Za nacistické okupace využil svého umění k odporu proti režimu: prezidentu Edvardu Benešovi nabídl spolu s Františkem Kabelákem symbolické 'astrologické útoky' na Adolfa Hitlera a v rámci Universalie prováděl rituální ničení Hitlerova horoskopu. V červnu 1941 byl zatčen gestapem za protiokupační výroky, odmítl nabídku stát se jedním z astrologů režimu a 3. prosince 1941 zemřel v koncentračním táboře Flossenbürg ve věku 35 let."
	],
	fr: [
		'Jan Kefer (1906-1941) était un astrologue, occultiste et érudit tchèque de la tradition hermétique — et le personnage dont cette application porte le nom.',
		"Né le 31 janvier 1906 à Nový Bydžov, il étudie au gymnase archiépiscopal de Prague puis obtient un doctorat de philosophie à l'Université Charles en 1928. Polyglotte parlant douze langues, il travaille comme bibliothécaire au Musée national, au monastère de Strahov et à la Bibliothèque vaticane, tout en poursuivant une étude de toute une vie sur l'astrologie, la kabbale, l'alchimie et la magie.",
		"Il est secrétaire puis président d'Universalia, la société hermétique tchécoslovaque, et dirige sa revue Logos. Auteur et traducteur prolifique, on lui doit notamment Astrologie pratique (1939) et une édition tchèque du Livre tibétain des morts.",
		"Pendant l'occupation nazie, Kefer met son art au service de la résistance : il propose, avec František Kabelák, au président Edvard Beneš de mener des « attaques astrologiques » symboliques contre Hitler, puis accomplit au sein d'Universalia des rituels visant à détruire l'horoscope du dictateur. Arrêté par la Gestapo en juin 1941 pour des propos hostiles à l'occupation, il refuse de rejoindre les astrologues du régime et meurt au camp de concentration de Flossenbürg le 3 décembre 1941, à l'âge de 35 ans."
	],
	es: [
		'Jan Kefer (1906-1941) fue un astrólogo, ocultista y erudito checo de la tradición hermética, y da nombre a esta aplicación.',
		'Nacido el 31 de enero de 1906 en Nový Bydžov, estudió en el Gimnasio Arzobispal de Praga y en 1928 obtuvo el doctorado en filosofía por la Universidad Carolina. Políglota, con dominio de doce idiomas, trabajó como bibliotecario en el Museo Nacional, el monasterio de Strahov y la Biblioteca Vaticana, mientras dedicaba toda su vida al estudio de la astrología, la cábala, la alquimia y la magia.',
		'Fue secretario y más tarde presidente de Universalia, la sociedad hermética checoslovaca, y dirigió su revista Logos. Escritor y traductor prolífico, es autor de Astrología práctica (1939) y traductor de una edición checa del Libro tibetano de los muertos.',
		"Durante la ocupación nazi, Kefer puso su arte al servicio de la resistencia: junto con František Kabelák, propuso al presidente Edvard Beneš 'ataques astrológicos' simbólicos contra Hitler, y más tarde realizó, dentro de Universalia, rituales para destruir el horóscopo del dictador. Detenido por la Gestapo en junio de 1941 por declaraciones contrarias a la ocupación, rechazó la oferta de unirse a los astrólogos del régimen y murió en el campo de concentración de Flossenbürg el 3 de diciembre de 1941, a los 35 años."
	]
};
