export type EditorIcon = {
	type: 'svg'
	id: string
} | {
	type: 'data'
	data: string
} | {
	type: 'text'
	name: string
}

const merkaartorIcon =
"data:image/png;base64," +
"iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADSE" +
"lEQVQ4ywXBW0xbdQDA4V/Praen9zrKRQrtoDABYYOI84ZRhy5Z" +
"4maiMxkxPviq8c3om0/GV5+mZiZuZm9bfNmIYYkJMTFZhpaxZQ" +
"wcZC1QSinrhdL29Fz+fp/nxuVZsZxZomWCqmnki00Wl5ocNSxm" +
"puOk+rvZzO6BcPEbPlI9gvKhS1A3iXelUP59sIfVtsjtmtx7aF" +
"E9hHPvpBgZjjM5nkTVo9y9t8LKgyfc+StLy4SRAQ/pPhWHAooi" +
"22TW66znPOgafPP1KV4YO81WdpXdkslecZ2QX2JycgKf7yGm6X" +
"DzjyLHIoJw2EQJhwyyu1CtC8IB+OFKhrad4c1XB2gcLlMoVsju" +
"QsuERhtiQZga1VheEwykZKSQH/bLYLah0YL9Knx4toe5i2/xya" +
"X36O324zhgC7AsmBo1ODksIUsWjzYcpLarY9sQDcH0i16ChkS1" +
"oeMKmVJVoSOm0RGDoT4VQ4d60yVouCQ6oXjQRqnWZTweiARhdN" +
"DPmdc7uDG/wfNLG9xeWEJ2K1gOlEs2QoBHmKiqTk9cYrMAirBr" +
"dEQhYEAooKDKFl99PoushZkaexevEeba1d8YTA+Ry20zNiBRqb" +
"Xo7ZTYe3aEJMsKpSr0d6tEI358RoCt7QI//vonT7dKXPnlOgiL" +
"y9dWiMcUBAqq6sGnq4SDGkrL0kCAEBKO43BUr3D19x36e48xv5" +
"ChXm+yXxZc+mCcjtgB4ZCOZbXQVPDgIOGRCQVgeMCPpvkwzTbJ" +
"LocL517CcQW1I4HqDTD79gRHppfvf8oi8NJuN5EVBUnVDFL9nS" +
"QSx3m8WUXWE0yMRLh1a57xIY3tPZiaSOPYFhs5k2ze5ruf99gp" +
"BVBkF2UwGWP6yzPIikrm/mNW17aIR6Gzw0C4LaIh6E88h6wG2d" +
"4poXvBsuHmnQrJXgP5i89Ofytci918nkgsQbIvwtNcme6uGCuP" +
"imTzAtduospHdHeFaDQOuXh+muO9XvKFCkq5ahMyXFZW89QaOh" +
"9fOIUQMk/W/uH+msv5syd47eVRkqkUh7UDZmbeQFF0hLDZKVxH" +
"elauUq9VWFjcIBz0oihe0uk0txdrzH30Cp/Ovc+J0ZPIqo+/76" +
"6i60F0X5DN/5YJ+SX+B9iyZV21U+bvAAAAAElFTkSuQmCC"

const editorData: [
		createdByPrefix: string,
		url: string,
		editorId: EditorIcon
][]=[
	[
		'Every Door',
		'https://wiki.openstreetmap.org/wiki/Every_Door',
		{type:'svg',id:'everydoor'},
	],[
		'Go Map!!',
		'https://wiki.openstreetmap.org/wiki/Go_Map!!',
		{type:'svg',id:'gomap'},
	],[
		'https://osm.wikidata.link/',
		'https://wiki.openstreetmap.org/wiki/OSM_%E2%86%94_Wikidata_matcher',
		{type:'text',name:'OSM↔Wikidata'},
	],[
		'iD',
		'https://wiki.openstreetmap.org/wiki/ID',
		{type:'svg',id:'id'},
	],[
		'JOSM',
		'https://wiki.openstreetmap.org/wiki/JOSM',
		{type:'svg',id:'josm'},
	],[
		'Map builder',
		'https://www.bing.com/mapbuilder/',
		{type:'svg',id:'mapbuilder'},
	],[
		'MapComplete',
		'https://wiki.openstreetmap.org/wiki/MapComplete',
		{type:'svg',id:'mapcomplete'},
	],[
		'MAPS.ME',
		'https://wiki.openstreetmap.org/wiki/MAPS.ME',
		{type:'svg',id:'mapsme'},
	],[
		'Merkaartor',
		'https://wiki.openstreetmap.org/wiki/Merkaartor',
		{type:'data',data:merkaartorIcon},
	],[
		'Organic Maps',
		'https://wiki.openstreetmap.org/wiki/Organic_Maps',
		{type:'svg',id:'organicmaps'},
	],[
		'OsmAnd',
		'https://wiki.openstreetmap.org/wiki/OsmAnd',
		{type:'svg',id:'osmand'},
	],[
		'Osmose Editor',
		'https://wiki.openstreetmap.org/wiki/Osmose#Osmose_integrated_tags_editor',
		{type:'svg',id:'osmose'},
	],[
		'Potlatch',
		'https://wiki.openstreetmap.org/wiki/Potlatch',
		{type:'svg',id:'potlatch'},
	],[
		'RapiD',
		'https://wiki.openstreetmap.org/wiki/Rapid',
		{type:'svg',id:'rapid'},
	],[
		'StreetComplete',
		'https://wiki.openstreetmap.org/wiki/StreetComplete',
		{type:'svg',id:'streetcomplete'},
	],[
		'Vespucci',
		'https://wiki.openstreetmap.org/wiki/Vespucci',
		{type:'svg',id:'vespucci'},
	],
]

export default editorData
