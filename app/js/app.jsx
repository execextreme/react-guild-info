window.App = React.createClass({
    getInitialState: function () {
        if (document.cookie.length) {
            var cookies = document.cookie.split('; ');
            var state = {};

            _.each(cookies, function (cookie) {
                var cookie_parts = cookie.split('=');
                state[cookie_parts[0]] = cookie_parts[1];
            });

            return state;
        }
        else {
            return {
                realm: null,
                guild_name: null,
                error_text: '',
            };
        }
    },
    setGuildInfo: function (opts) {
        var guild_name = opts.guild_name;

        // upper case the first letter in each word
        guild_name =
            _.join(
                _.map(
                    _.words(guild_name),
                    (word) => _.upperFirst(word)
                ),
                ' '
            );

        this.setState({
            realm: opts.realm,
            guild_name: guild_name,
            error_text: '',
        });
    },
    reset: function (event, err) {
        document.cookie = 'guild_name=; max-age=0; path=/';
        document.cookie = 'realm=; max-age=0; path=/';

        this.setState({
            realm: null,
            guild_name: null,
            error_text: err ? 'No guild with that name was found' : null
        });
    },
    render: function () {
        var error_style = {
            color: 'red',
            textAlign: 'center',
        };

        return (
            <div style={{margin: '8px'}}>

                <div style={error_style}>{this.state.error_text}</div>
                {
                    this.state.realm && this.state.guild_name
                        ? <Guild
                            realm={this.state.realm}
                            guild_name={this.state.guild_name}
                            reset={this.reset}
                        />
                        : <LoadBox setGuildInfo={this.setGuildInfo}/>
                }
            </div>
        );
    }
});

var LoadBox = React.createClass({
    getInitialState: function () {
        return {
            realm: '',
            guild_name: '',
            error_text: '',
        };
    },
    setRealm: function (val) {
        this.setState({realm: val});
    },
    setGuild: function (event) {
        var val = event.target.value;

        if (val && !val.match(/^[A-z ]+$/)) {
            this.setState({error_text: 'Guild names only contain letters'});
        }
        else {
            this.setState({guild_name: val, error_text: ''});
        }
    },
    submit: function () {
        this.props.setGuildInfo(this.state);
    },
    keyDown: function (event) {
        if (event.keyCode == 13) {
            this.submit();
        }
    },
    render: function () {
        var loading_style = {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            margin: 'auto',
            width: '300px',
            height: '100px',
        };

        var error_style = {
            color: 'red',
        };

        return (
            <div style={loading_style} onKeyDown={this.keyDown}>
                <h1>Guild Info</h1>

                <h2 style={{marginTop: '16px'}}>Realm</h2>
                <RealmAutocompleteBox setRealm={this.setRealm}/>

                <h2 style={{marginTop: '16px'}}>Guild</h2>
                <input className="form-control" type="text" onChange={this.setGuild} value={this.state.guild_name}/>

                <div style={error_style}>{this.state.error_text}</div>
                <button style={{marginTop: '16px'}} type="button" className="btn btn-primary" onClick={this.submit}>Go!</button>

                <br/>
                <br/>
                <a href="https://github.com/execextreme/react-guild-info" target="_blank">Fork this on Github</a>
            </div>
        );
    }
});

var RealmAutocompleteBox = React.createClass({
    getInitialState: function () {
        return {
            data: null,
            value: '',
            ahead: '',
            full_ahead: ''
        }
    },
    componentDidMount: function () {
        do_api_req('realm/status', {}, function (res) {
            this.setState({
                data: _.map(res.realms, (item) => (item.name))
            });
        }.bind(this));
    },
    attemptComplete: function (event) {
        if (event.keyCode == 39 || event.keyCode == 9 || event.type == 'blur') {
            this.setState({
                value: this.state.full_ahead,
                ahead: '',
            });

            this.props.setRealm(this.state.full_ahead);
        }
    },
    typeAhead: function (event) {
        var val = event.target.value;

        if (val.length == 0) {
            this.setState({
                value: '',
                ahead: '',
                full_ahead: ''
            });
            return;
        }

        // check our list for matches
        var re = new RegExp('^' + val + '(.*)', 'i');
        var matches = [];
        _.each(this.state.data, function (realm) {
            var match = realm.match(re);
            if (match) {
                matches.push(match);
            }
        });

        // ahead is the text the user hasn't typed in
        // full ahead is the full text of what is guessed
        var ahead;
        var full_ahead;
        if (matches.length) {
            ahead      = matches[0][1];
            full_ahead = matches[0][0];
        }

        this.setState({
            value: val,
            ahead: ahead,
            full_ahead: full_ahead
        });

        this.props.setRealm(full_ahead);
    },
    render: function () {
        var data = this.state.data;
        if (data === null) {
            return (
                <input className="form-control" type="text" disabled/>
            )
        }

        var text_style = {
            position: 'relative',
            bottom: '31px',
            left: '13px',
            height: 0,
        };

        // use a 'hidden' div to display our typed and predicted text
        return (
            <div>
                <input className="form-control" type="text"
                    onChange={this.typeAhead}
                    onKeyDown={this.attemptComplete}
                    onBlur={this.attemptComplete}
                    value={this.state.value}
                />
                <div style={text_style}>
                    <span>{this.state.value}</span>
                    <span style={{opacity: '0.54'}}>{this.state.ahead}</span>
                </div>
            </div>
        );
    }
});

var Guild = React.createClass({
    getInitialState: function () {
        return {
            data: null,
            loot_filter: false,
            total_members: null,
            done_members: 0,
        };
    },
    componentDidMount: function () {
        this.get_data(this.props);
    },
    componentWillReceiveProps: function (next_props) {
        this.get_data(next_props);
    },
    toggleLootFilter: function () {
        this.setState({loot_filter: !this.state.loot_filter});
    },
    get_data: function (opts) {
        do_api_req('guild', {
            realm:      opts.realm,
            guild_name: opts.guild_name,
            fields: 'members,news',
        }, function (guild_res) {
            if (guild_res.code || guild_res.status) {
                this.props.reset(null, 1);
                return;
            }

            var members = _.filter(guild_res.members, (member) => (member.character.level === 110));
            this.setState({total_members: members.length});

            // query the character api for additional stats on all max level members
            _.each(members, function (member) {
                do_api_req('character', {
                    realm:          opts.realm,
                    character_name: member.character.name,
                    fields: 'items,professions',
                }, function (res) {
                    // code and status can be set when errors occur
                    if (!res.code && !res.status) {
                        member.character.ilvl = res.items.averageItemLevelEquipped || res.items.averageItemLevel;
                        member.character.professions = res.professions;
                    }

                    // defer setting guild state until all character requests have completed
                    var completed = ++this.state.done_members;
                    if (completed == this.state.total_members) {
                        this.setState({data: guild_res});
                        this.saveCookie(opts);
                    }
                    else {
                        this.setState({done_members: completed});
                    }

                }.bind(this));
            }.bind(this));
        }.bind(this));
    },
    saveCookie: function (opts) {
        document.cookie = 'guild_name=' + opts.guild_name+ '; max-age=100000000; path=/';
        document.cookie = 'realm=' + opts.realm+ '; max-age=100000000; path=/';
    },
    render: function () {
        var data = this.state.data;

        // show loading indicator
        if (data === null) {
            var loading_style = {
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                margin: 'auto',
                width: '300px',
                height: '100px',
            };

            return (
                <div style={loading_style}>
                    <h1>Loading...</h1>
                    <h2>Realm: {this.props.realm}</h2>
                    <h2>Guild: {this.props.guild_name}</h2>
                    {
                        this.state.total_members
                            ? <h3>{this.state.done_members} / {this.state.total_members} characters </h3>
                            : false
                    }
                </div>
            );
        }

        var heading_style = {
            paddingBottom: '16px',
            textAlign: 'center',
            borderBottom: '1px solid #e0e0e0',
        };

        var filter_style = {
            height: 0,
            position: 'relative',
            left: '400px',
            bottom: '50px',
        };

        var updated_ago = moment(data.lastModified).fromNow();

        // bucket the news items by day
        var news = _.groupBy(data.news, (item) => moment(item.timestamp).startOf('day').valueOf());

        // an array of the keys we will use to access the bucketed collection - sorted by timestamp desc
        var news_keys =
            _.reverse(
                _.sortBy(
                    _.keys(news)
                )
            );

        // sort members by ilvl desc
        var members =
            _.reverse(
                    _.sortBy(
                        data.members.filter((member) => (member.character.ilvl > 820)),
                        (member) => (member.character.ilvl)
                    )
            );

        return (
            <div>
                <nav style={{marginBottom: '16px'}} className="navbar navbar-light bg-faded">
                    <div className="nav navbar-nav">
                        <a className="navbar-brand" href="#">{'Guild info for ' + data.name + ' on ' + data.realm}</a>
                        <a className="nav-item nav-link" href="#" onClick={this.props.reset}>Change</a>
                        <span className="navbar-brand pull-xs-right">Last Updated: {updated_ago}</span>
                    </div>
                </nav>

                <div style={{width: '300px', float: 'left', marginRight: '64px'}}>
                    <h3 style={heading_style}>Members</h3>
                    {
                        members.map(function (member) {
                            return <Member key={member.character.name} data={member.character} />
                        })
                    }
                </div>

                <div style={{width: '500px', float: 'left'}}>
                    <h3 style={heading_style}>News</h3>

                    <label htmlFor="loot_filter" style={filter_style}>
                        Loot Filter
                        <input
                            id="loot_filter"
                            type="checkbox"
                            onChange={this.toggleLootFilter}
                            checked={this.state.loot_filter ? 'checked' : ''}
                            style={{marginLeft: '4px'}}
                        />
                    </label>
                    {
                        news_keys.map(function (news_date) {
                            return <NewsSection
                                        key={news_date}
                                        date={_.toNumber(news_date)}
                                        news_data={news[news_date]}
                                        filter={this.state.loot_filter}
                                    />
                        }.bind(this))
                    }
                </div>

            </div>
        );
    }
});

var Member = React.createClass({
    render: function () {
        var data = this.props.data;

        var bar_style = {
            width: 400 * ((data.ilvl-800) / 100),
            height: '20px',
            background: '#1c8aff',
            position: 'relative',
            zIndex: 1,
            bottom: '25px',
        };

        var text_style = {
            fontSize: '20px',
            color: 'white',
            position: 'relative',
            zIndex: 2,
            textShadow: '1px 1px 1px #000',
            left: '2px',
        };

        var class_text;
        if (data.spec) {
            class_text = data.spec.name + ' ' + get_class_name(data.class);
        }
        else {
            class_text = get_class_name(data.class);
        }

        var professions;
        if (data.professions) {
            var cooking = data.professions.secondary.find((prof) => (prof.name == 'Cooking'));
            professions = _.concat(data.professions.primary, cooking);
        }

        return (
            <div className="media">
                <a className="media-left media-middle" href="#">
                    <img className="media-object" src={get_class_url(data.class)} alt={data.class}/>
                </a>
                <div className="media-body">
                    <a className="media-heading"
                        href={'http://us.battle.net/wow/en/character/' + data.guildRealm + '/' + data.name + '/simple'}
                        target="_blank"
                        style={{fontSize: '24px'}}
                    >
                        {data.name}
                    </a>
                    <h5>{class_text}</h5>

                    {
                        professions.map(function(prof) {
                            return (
                                <span key={data.guildRealm+data.name+prof.name}>
                                    <a
                                        href={"http://us.battle.net/wow/en/character/" + data.guildRealm + "/" + data.name + "/profession/" + _.lowerCase(prof.name)}
                                        target="_blank"
                                    >
                                        <img src={'http://media.blizzard.com/wow/icons/18/' + prof.icon + '.jpg'}/>
                                        <span style={{paddingRight: '4px', paddingLeft: '4px'}}>{prof.rank}</span>
                                    </a>
                                </span>
                            )
                        })
                    }

                    <div style={text_style}>{data.ilvl}</div>
                    <div style={bar_style}></div>
                </div>
            </div>
        )
    },
});

var NewsSection = React.createClass({
    getInitialState: function () {
        return {show: true};
    },
    toggleShow: function () {
        this.setState({show: !this.state.show});
    },
    render: function () {
        var date = this.props.date;
        var news = this.props.news_data;

        var date_style = {
            fontSize: '22px',
            fontWeight: 'bold',
            textAlign: 'center',
        };

        var display_date = moment(date).format('M/DD');

        var section_style = {
            border: '1px solid #e0e0e0',
            padding: '16px',
            margin: '16px',
        };

        var icon_style = {
            fontSize: '20px',
            position: 'relative',
            float: 'right',
            bottom: '28px',
            color: 'grey',
            cursor: 'pointer',
        };

        var icon = this.state.show ? 'minus' : 'plus'

        return (
            <div style={section_style}>
                <div style={date_style}>{display_date}</div>
                <i
                    style={icon_style}
                    className={"fa fa-" + icon + "-square"}
                    aria-hidden="true"
                    onClick={this.toggleShow}>
                </i>

                <div style={this.state.show ? {} : {'display': 'none'}}>
                    {
                        news.map(function (news_item_data) {
                            var key = news_item_data.character + news_item_data.timestamp;
                            if (news_item_data.type == 'playerAchievement') {
                                key += news_item_data.achievement.id;
                            }
                            else {
                                key += news_item_data.itemId;
                            }

                            return <NewsItem key={key} data={news_item_data} filter={this.props.filter}/>
                        }.bind(this))
                    }
                </div>
            </div>
        );
    }
});

var NewsItem = React.createClass({
    getInitialState: function () {
        return {
            item_name: null,
            item_quality: 0,
        }
    },
    componentDidMount: function () {
        var data = this.props.data;

        if (data.type == 'itemLoot' || data.type == 'itemCraft') {
            do_api_req('item/' + data.itemId, {}, function (res) {
                if (res.code) {
                    return;
                }

                this.setState({item_name: res.name, item_quality: res.quality});
            }.bind(this));
        }
        else if (data.type == 'playerAchievement') {
            this.setState({item_name: data.achievement.title});
        }
    },
    render: function () {
        var data = this.props.data;

        if (
            this.state.item_name === null ||
            (this.props.filter && this.state.item_quality < 4)
        ) {
            return <div></div>;
        }

        var type = {
            'itemLoot': 'looted',
            'playerAchievement': 'earned achievement',
            'itemCraft': 'crafted',
        };

        var item_href;

        if (data.type == 'itemLoot' || data.type == 'itemCraft') {
            item_href = "http://www.wowhead.com/item=" + data.itemId;
        }
        else if (data.type == 'playerAchievement') {
            item_href = "http://www.wowhead.com/achievement=" + data.achievement.id;
        }

        return (
            <div>
                <span style={{paddingRight: '4px'}}>{data.character}</span>
                <span style={{paddingRight: '4px'}}>{type[data.type] || data.type}</span>
                <a href={item_href} className={"q" + this.state.item_quality} target="_blank">
                    {this.state.item_name}
                </a>
            </div>
        );
    }
});

function do_api_req (endpoint, opts, cb) {
    // construct the url
    var url = 'https://us.api.battle.net/wow/' + endpoint;

    if (opts.realm) {
        url += '/' + opts.realm;
    }

    if (opts.guild_name) {
        url += '/' + opts.guild_name;
    }

    if (opts.character_name) {
        url += '/' + opts.character_name;
    }

    var params = {
        locale: 'en_US',
        apikey: '<INSERT API KEY HERE>',
        fields: opts.fields || '',
    };

    // make the request, call cb with the result
    return $.ajax({
        url: url,
        jsonp: 'jsonp',
        dataType: 'jsonp',
        data: params,
        success: function (res) {
            cb(res);
        },
        error: function (res) {
            cb(res);
        },
    });
}

function get_class_name (id) {
    var class_names = {
        1: 'Warrior',
        2: 'Paladin',
        3: 'Hunter',
        4: 'Rogue',
        5: 'Priest',
        6: 'Death Knight',
        7: 'Shaman',
        8: 'Mage',
        9: 'Warlock',
        10: 'Monk',
        11: 'Druid',
        12: 'Demon Hunter',
    };

    return class_names[id];
}

function get_class_url (id) {
    var class_names = {
        1: 'warrior',
        2: 'paladin',
        3: 'hunter',
        4: 'rogue',
        5: 'priest',
        6: 'death-knight',
        7: 'shaman',
        8: 'mage',
        9: 'warlock',
        10: 'monk',
        11: 'druid',
        12: 'demon-hunter',
    };

    return 'http://us.media.blizzard.com/wow/icons/56/class_' + class_names[id] + '.jpg';
}