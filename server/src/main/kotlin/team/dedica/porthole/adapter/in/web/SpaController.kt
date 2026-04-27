package team.dedica.porthole.adapter.`in`.web

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.RequestMapping

// SPA fallback: forwards frontend routes to index.html.
// Excluded: /api, /ws, /ws-native, /assets, /fonts and paths with a dot.
@Controller
class SpaController {

    @RequestMapping("/")
    fun root(): String = "forward:/index.html"

    @RequestMapping("/{path:^(?!assets|fonts|api|ws-native|ws)[^.]+}")
    fun singleSegment(): String = "forward:/index.html"

    @RequestMapping(value = ["/{first:^(?!assets|fonts|api|ws-native|ws)[^.]+}", "/{first:^(?!assets|fonts|api|ws-native|ws)[^.]+}/**"])
    fun deepLink(): String = "forward:/index.html"
}
