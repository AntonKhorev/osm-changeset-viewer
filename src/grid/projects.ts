import {makeElement} from '../util/html'

const projectManagerData: {[hashtagPrefix: string]: {
	title: string
	domain: string
	wikiUrl: string
	icon?: string
}} = {
	'hotosm-project': {
		title: `HOT project`,
		domain: `hotosm.org`,
		wikiUrl: `https://wiki.openstreetmap.org/wiki/Humanitarian_OSM_Team#The_Tasking_Manager`,
		icon: `hotosm`,
	},
	'teachosm-project': {
		title: `TeachOSM project`,
		domain: `teachosm.org`,
		wikiUrl: `https://wiki.openstreetmap.org/wiki/TeachOSM`,
		icon: `teachosm`,
	},
	'kaart': {
		title: `Kaart project`,
		domain: `kaart.com`,
		wikiUrl: `https://wiki.openstreetmap.org/wiki/Kaart`,
		icon: `kaart`,
	},
	'osmus-tasks': {
		title: `OSM US task`,
		domain: `openstreetmap.us`,
		wikiUrl: `https://wiki.openstreetmap.org/wiki/Foundation/Local_Chapters/United_States`,
	},
}

const commentMatchRegexp=new RegExp(`#(${Object.keys(projectManagerData).join('|')})-(\\d+)`)

export default function makeProjectBadgeContentFromComment(comment: string): (HTMLElement|string)[] | null {
	const match=comment.match(commentMatchRegexp)
	if (!match) return null
	const [hashtag,hashtagPrefix,id]=match
	const projectManager=projectManagerData[hashtagPrefix]
	if (!projectManager) return null
	const $wikiLink=makeElement('a')()()
	$wikiLink.href=projectManager.wikiUrl
	if (projectManager.icon!=null) {
		$wikiLink.title=projectManager.title
		$wikiLink.innerHTML=`<svg width="16" height="10"><use href="#project-${projectManager.icon}" /></svg>`
	} else {
		$wikiLink.textContent=projectManager.title
		$wikiLink.classList.add('project-text')
	}
	const $projectLink=makeElement('a')('project-text')(id)
	$projectLink.href=`https://tasks.${projectManager.domain}/projects/${id}`
	$projectLink.title=hashtag
	return [$wikiLink,` `,$projectLink]
}
