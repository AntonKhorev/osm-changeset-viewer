type Script = 'Latn'|'Cyrl'

type DecoratedNameChunk = [
	text: string,
	warning?: {
		belongsTo?: Script
		surroundedBy?: Script
	}
]

const latinLetters    = 'ABCEHKMOPTXaceopxy'
const cyrillicLetters = 'АВСЕНКМОРТХасеорху' // can also add non-Russian letters like 'i' 

export default function decorateUserName(name: string): DecoratedNameChunk[] {
	const chunks:DecoratedNameChunk[]=[]
	const re=new RegExp(`(.*?\\p{Script=Latn})([${cyrillicLetters}]+)(?=\\p{Script=Latn})`,'uy')
	let idx=0
	while (true) {
		idx=re.lastIndex
		const match=re.exec(name)
		if (!match) break
		const [,beforeInclusion,inclusion]=match
		chunks.push([beforeInclusion])
		chunks.push([inclusion,{belongsTo:'Cyrl',surroundedBy:'Latn'}])
	}
	chunks.push([name.slice(idx)])
	return chunks
}
