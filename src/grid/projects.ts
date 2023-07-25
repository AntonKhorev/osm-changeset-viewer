import {makeElement} from '../util/html'
import {escapeRegex, makeEscapeTag} from '../util/escape'

const er=makeEscapeTag(escapeRegex)

type ProjectManager = {
	title: string
	taskUrl: string
	wikiUrl: string
	icon?: string
}

const projectManagerData: {[hashtagPrefix: string]: ProjectManager} = {
	'hotosm-project': {
		title: `HOT project`,
		taskUrl: taskUrl(`hotosm.org`),
		wikiUrl: `https://wiki.openstreetmap.org/wiki/Humanitarian_OSM_Team#The_Tasking_Manager`,
		icon: `hotosm`,
	},
	'teachosm-project': {
		title: `TeachOSM project`,
		taskUrl: taskUrl(`teachosm.org`),
		wikiUrl: `https://wiki.openstreetmap.org/wiki/TeachOSM`,
		icon: `teachosm`,
	},
	'kaart': {
		title: `Kaart project`,
		taskUrl: taskUrl(`kaart.com`),
		wikiUrl: `https://wiki.openstreetmap.org/wiki/Kaart`,
		icon: `kaart`,
	},
	'osmus-tasks': {
		title: `OSM US task`,
		taskUrl: taskUrl(`openstreetmap.us`),
		wikiUrl: `https://wiki.openstreetmap.org/wiki/Foundation/Local_Chapters/United_States`,
	},
}

const taskManagerMatcher=new RegExp(`#(${Object.keys(projectManagerData).join('|')})-(\\d+)`)
const mapRouletteMatcher=new RegExp(er`\\b${'https://maproulette.org/browse/challenges/'}(\\d+)`)

export default function makeProjectBadgeContentFromComment(comment: string): (HTMLElement|string)[] | null {
	let match:RegExpMatchArray|null
	let projectManager:ProjectManager
	let projectId:string
	let projectTitle:string
	if (match=comment.match(taskManagerMatcher)) {
		const [hashtag,hashtagPrefix,id]=match
		projectManager=projectManagerData[hashtagPrefix]
		if (!projectManager) return null
		projectId=id
		projectTitle=hashtag
	} else if (match=comment.match(mapRouletteMatcher)) {
		;[projectTitle,projectId]=match
		projectManager={
			title: `MapRoulette challenge`,
			taskUrl: `https://maproulette.org/browse/challenges`,
			wikiUrl: `https://wiki.openstreetmap.org/wiki/MapRoulette`,
		}
	} else {
		return null
	}
	const $wikiLink=makeElement('a')()()
	$wikiLink.href=projectManager.wikiUrl
	if (projectManager.icon!=null) {
		$wikiLink.title=projectManager.title
		$wikiLink.innerHTML=`<svg width="16" height="10"><use href="#project-${projectManager.icon}" /></svg>`
	} else {
		$wikiLink.textContent=projectManager.title
		$wikiLink.classList.add('project-text')
	}
	const $projectLink=makeElement('a')('project-text')(projectId)
	$projectLink.href=`${projectManager.taskUrl}/${projectId}`
	$projectLink.title=projectTitle
	return [$wikiLink,` `,$projectLink]
}

function taskUrl(domain: string): string {
	return `https://tasks.${domain}/projects`
}
