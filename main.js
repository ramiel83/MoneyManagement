// mm = Money Management
var mm = {
    current_user: null,
    categories: []
};

$(function () {
    // get the categories from the server, after that, initialize GUI.
    get_categories(function () {
        init_gui();
    });

    // login submit button
    $("#login_submit").click(function () {
        var username = $("#user_name").val();
        var password = $("#password").val();
        $.get("index.php?action=login&username=" + username + "&password=" + password, function (data) {
            if (data.user_id != null) {
                mm.current_user = {
                    user_id: data.user_id,
                    username: username
                };
                change_page("menu_page");
            } else {
                alert("Wrong username / password. please try again.");
            }
        });
    });

    // when displaying the menu page, put the current username in the title.
    $('#menu_page').bind('isVisible', function () {
        $("#current_user_name").text(mm.current_user.username);
    });

    $("#settings_button").click(function () {
        change_page("settings_page");
    });

    // when displaying the settings page, remove the current table, and filter from the server.
    $("#settings_page").bind("isVisible", function () {
        // delete all TRs
        $("#max_spending_table tr").remove();

        $("#max_spending_table").append("<tr><th>Category</th><th>Totals</th><th>Update</th></tr>");
        $.get("index.php?action=get_max_spending_for_user&user_id=" + mm.current_user.user_id, function (data) {
            $.each(data, function (i, item) {
                var row = "<tr>";
                row += "<td>" + mm.categories[item.category_id] + "</td>";
                var total_table = "<table>" +
                    "<tr>" +
                    "<td>Month: </td>" +
                    "<td><input id=\"total_month_" + item.id + "\" type=\"text\" value=\"" + item.total_month + "\" class=\"form-control\" /></td>" +
                    "</tr>" +
                    "<tr>" +
                    "<td>Week: </td>" +
                    "<td><input id=\"total_week_" + item.id + "\" type=\"text\" value=\"" + item.total_week + "\" class=\"form-control\" /></td>" +
                    "</tr>" +
                    "<tr>" +
                    "<td>Day: </td>" +
                    "<td><input id=\"total_day_" + item.id + "\" type=\"text\" value=\"" + item.total_day + "\" class=\"form-control\" /></td>" +
                    "</tr>" +
                    "</table>"
                row += "<td>" + total_table + "</td>";
                row += "<td><input type=\"button\" value=\"Update\" class=\"btn btn-default\" onclick=\"settings_update('" + item.id + "')\" /></td>";
                row += "</tr>";
                $("#max_spending_table").append(row);
            });

            document.getElementById('testViewport').setAttribute('content', 'width=380');
        });
    });

    $("#settings_page_back").click(function () {
        change_page("menu_page");
    });

    $("#transactions_button").click(function () {
        change_page("transactions_page");
    });

    $("#new_transaction_button").click(function () {
        change_page("new_transaction_page");
    });

    $("#new_transaction_page_back").click(function () {
        change_page("menu_page");
    });

    $("#new_transaction_page_submit").click(function () {
        var category_id = $("#new_transaction_category_select").val();
        var total = $("#total").val();
        var text = $("#text").val();
        var transaction_datetime = $("#transaction_datetime").val();
        $.get("index.php?action=new_transaction&user_id=" + mm.current_user.user_id + "&category_id=" + category_id + "&total=" + total + "&text=" + text + "&datetime=" + transaction_datetime, function (data) {
            if (!data.inserted) {
                alert("General error, not inserted!");
                return;
            }

            alert("New transaction inserted");

            // if there was an exceeded amount, show it to the user (it still doesn't prevent entering the new transaction)
            if (data.exceeded_msg != '') {
                alert(data.exceeded_msg);
            }

            // go back to the menu after inserting the new transaction.
            change_page("menu_page");
        });
    });

    $("#transactions_page").bind("isVisible", function () {

    });

    // each time we press the search_transactions_button, we apply the filtering (and show the table)
    $("#search_transactions_button").click(function () {
        apply_filtering();
    });

    $("#transactions_page_back").click(function () {
        change_page("menu_page");
    });

    $("#edit_transaction_page_submit").click(function () {
        var transaction_id = $("#edit_transaction_id").val();
        var category_id = $("#edit_transaction_category_select").val();
        var total = $("#edit_total").val();
        var text = $("#edit_text").val();
        var datetime = $("#edit_transaction_datetime").val();
        $.get("index.php?action=update_transaction&id=" + transaction_id + "&category_id=" + category_id + "&total=" + total + "&text=" + text + "&datetime=" + datetime, function (data) {
            if (!data.updated) {
                alert("General error, not updated!");
                return;
            }

            alert("Success Updating transaction");

            // if there was an exceeded amount, show it to the user (it still doesn't prevent entering the new transaction)
            if (data.exceeded_msg != '') {
                alert(data.exceeded_msg);
            }

            change_page("transactions_page");
            apply_filtering();
        });
    });

    $("#edit_transaction_page_back").click(function () {
        change_page("transactions_page");
    });
});

// get all the categories and put it in mm.categories
function get_categories(success_func) {
    $.get("index.php?action=categories_list", function (data) {
        $.each(data, function (i, item) {
            mm.categories[item.id] = item.name;
        });

        success_func();
    });
}

// initialize general GUI.
function init_gui() {
    // new transactions
    // init datepicker for new transaction
    $('#new_transaction_datepicker').datetimepicker({format: "YYYY-MM-DD HH:mm:ss"});

    // init categories in new transaction
    $.each(mm.categories, function (i, item) {
        if (item) {
            $("#new_transaction_category_select").append("<option value='" + i + "'>" + item + "</option>");
        }
    });


    // transactions filters
    $('#transactions_from_date_datepicker').datetimepicker({format: "YYYY-MM-DD HH:mm:ss"});
    $('#transactions_to_date_datepicker').datetimepicker({format: "YYYY-MM-DD HH:mm:ss"});
    $.each(mm.categories, function (i, item) {
        if (item) {
            $("#transactions_category_select").append("<option value='" + i + "'>" + item + "</option>");
        }
    });

    $('#edit_transaction_datetime').datetimepicker({format: "YYYY-MM-DD HH:mm:ss"});
    $.each(mm.categories, function (i, item) {
        if (item) {
            $("#edit_transaction_category_select").append("<option value='" + i + "'>" + item + "</option>");
        }
    });
}

// this functions hides all the pages, and displays only the page specified (new_page_id). also triggers our own custom isVisible event
function change_page(new_page_id) {
    $("[data-role=page]").hide();
    $("#" + new_page_id).show('slow', function () {
        $(this).trigger('isVisible');
    });
}

function settings_update(max_update_id) {
    var total_month = $("#total_month_" + max_update_id).val();
    var total_week = $("#total_week_" + max_update_id).val();
    var total_day = $("#total_day_" + max_update_id).val();

    $.get("index.php?action=update_max_spending&id=" + max_update_id + "&total_month=" + total_month + "&total_week=" + total_week + "&total_day=" + total_day, function (data) {
        if (data.error) {
            alert(data.error);
            return;
        }

        if (data.updated) {
            alert("Success updating");
        }
    });
}

function remove_transaction(transaction_id) {
    $.get("index.php?action=delete_transaction&id=" + transaction_id, function (data) {
        if (data.deleted) {
            alert("Success removing");
            apply_filtering();
        }
    });
}

// for use in the pie chart
var myLabelFormatter = function (context) {
    var label = context.label;

    // if it's a single bird seen, add an exclamation mark to the outer label
    if (context.section === 'outer') {
        if (context.value === 1) {
            label = label + '!';
        }
    }
    return label;
};

function apply_filtering() {
    var from_date = $("#transactions_from_date_datetime").val();
    var to_date = $("#transactions_to_date_datetime").val();
    var category_id = $("#transactions_category_select").val();
    $.get("index.php?action=show_transactions&user_id=" + mm.current_user.user_id + "&from_date=" + from_date + "&to_date=" + to_date + "&category_id=" + category_id, function (data) {
        $("#transactions_results tr").remove();

        $("#transactions_results").append("<tr><th>Category</th><th>Total</th><th>Text</th><th>Date/Time</th><th>Edit</th><th>Remove</th></tr>");
        $.each(data, function (i, item) {
            var row = "<tr>";
            row += "<td>" + mm.categories[item.category_id] + "</td>";
            row += "<td>" + item.total + "</td>";
            row += "<td>" + item.text + "</td>";
            row += "<td>" + item.datetime + "</td>";
            row += "<td><input type=\"button\" value=\"Edit\" class=\"btn btn-default\" onclick=\"edit_transaction('" + item.id + "')\" /></td>";
            row += "<td><input type=\"button\" value=\"Remove\" class=\"btn btn-default\" onclick=\"remove_transaction('" + item.id + "')\" /></td>";
            row += "</tr>";
            $("#transactions_results").append(row);
        });

        //create pie chart of categories / expenses totals
        var pie_categories = mm.categories.slice();
        $.each(pie_categories, function (i, item) {
            if (item) {
                pie_categories[i] = 0;
            }
        });
        $.each(data, function (i, item) {
            pie_categories[item.category_id] += parseFloat(item.total);
        });
        var pie_content = [];
        $.each(pie_categories, function (i, total) {
            if (total > 0) {
                pie_content.push({label: mm.categories[i], value: total, caption: total});
            }
        });

        $("#pie").empty();
        var pie = new d3pie("pie", {
            data: {
                content: pie_content
            },
            labels: {
                formatter: myLabelFormatter,
                inner: {
                    format: "value"
                }
            }
        });

        // create chart of totals / time
        var chart_data = [];
        $.each(data, function (i, item) {
            var date = item.datetime.substring(0, 10);
            var found = chart_data.find(function (row) {
                return row.Dates == date;
            });
            if (found == undefined) {
                chart_data.push({"Dates": date, "Total": parseFloat(item.total)});
            }
            else {
                found.Total += parseFloat(item.total);
            }
        });

        $("#chart").empty();
        var svg = dimple.newSvg("#chart", 500, 900);
        var data = chart_data;
        var chart = new dimple.chart(svg, data);
        chart.addCategoryAxis("x", "Dates");
        chart.addMeasureAxis("y", "Total");
        chart.addSeries(null, dimple.plot.bar);
        chart.draw();

        document.getElementById('testViewport').setAttribute('content', 'width=380');
    });
}

function edit_transaction(transaction_id) {
    $("#edit_transaction_id").val(transaction_id);
    $.get("index.php?action=transaction_details&id=" + transaction_id, function (data) {
        $("#edit_total").val(data.total);
        $('#edit_transaction_category_select option[value=' + data.category_id + ']').attr('selected', 'selected');
        $("#edit_text").val(data.text);
        $("#edit_transaction_datetime").val(data.datetime);

        change_page("edit_transaction_page");
    });
}