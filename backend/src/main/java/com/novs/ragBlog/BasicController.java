package com.novs.ragBlog;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
public class BasicController {

    @GetMapping("/")
    @ResponseBody
    public String home() {
        return "hello!";
    }

    @GetMapping("/about")
    @ResponseBody
    public String about() {
        return "my name is nov";
    }

}
