window.onload = function() {
    prettyPrint();
    check_background();
}

function check_background() {
    var sidebar = $('#sidebar-wrapper');
    var content = $('#page-content-wrapper');
    var sidebar_h = sidebar.height()
    var content_h = content.height();
    if (content_h < sidebar_h)
        content.height(sidebar_h);
}
